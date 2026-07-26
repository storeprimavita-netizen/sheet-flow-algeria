"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import type { Role } from "@/lib/roles";

type ActionResult = { ok: true } | { ok: false; error: string };

async function baseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return (process.env.APP_URL ?? `${proto}://${host}`).replace(/\/$/, "");
}

// ---------------------------------------------------------------------------
// Users (profiles) — invite, role/duty/activation
// ---------------------------------------------------------------------------
const inviteSchema = z.object({
  email: z.string().trim().email(),
  role: z.enum(["admin", "confirmation_agent", "delivery_agent"]),
  duty: z.string().trim(),
});

/** Invite a new teammate. Service-role only: creates the auth user (which
 * trigger-inserts an inactive, workspace-less profile — 00001_core.sql), then
 * assigns workspace/role/duty and activates it in the same admin-client call
 * (RLS's pr_upd would otherwise reject this exact transition: a brand new
 * profile has workspace_id = null, which never matches current_workspace_id()). */
export async function inviteUser(input: { email: string; role: Role; duty: string }): Promise<ActionResult> {
  const { workspaceId } = await adminProfile();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const admin = await createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo: `${await baseUrl()}/reset-password`,
  });
  if (error || !data.user) return { ok: false, error: error?.message ?? "Invite failed" };

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      workspace_id: workspaceId,
      role: parsed.data.role,
      duty: parsed.data.duty || null,
      is_active: true,
    })
    .eq("user_id", data.user.id);
  if (profileError) return { ok: false, error: profileError.message };

  revalidatePath("/app/team");
  return { ok: true };
}

const updateUserSchema = z.object({
  role: z.enum(["admin", "confirmation_agent", "delivery_agent"]),
  duty: z.string().trim(),
  is_active: z.boolean(),
});

/** Role/duty/activation edits on an already-assigned profile: workspace_id is
 * already set and matches the admin's, so the normal session client (RLS,
 * `profiles_guard` trigger) is enough — no service role needed here. */
export async function updateUser(
  userId: string,
  input: { role: Role; duty: string; is_active: boolean },
): Promise<ActionResult> {
  const { workspaceId } = await adminProfile();
  const parsed = updateUserSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, duty: parsed.data.duty || null, is_active: parsed.data.is_active })
    .eq("user_id", userId)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/team");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Rules docs (CRUD, position reorder)
// ---------------------------------------------------------------------------
const ruleSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string(),
});

export async function saveRuleDoc(id: string | null, formData: FormData) {
  const { workspaceId } = await adminProfile();
  const input = ruleSchema.parse({ title: formData.get("title"), content: formData.get("content") });
  const supabase = await createClient();

  if (id) {
    const { error } = await supabase.from("rules_docs").update(input).eq("id", id).eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
  } else {
    const { data: last } = await supabase
      .from("rules_docs")
      .select("position")
      .eq("workspace_id", workspaceId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await supabase
      .from("rules_docs")
      .insert({ workspace_id: workspaceId, ...input, position: (last?.position ?? -1) + 1 });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/app/team/rules");
}

export async function deleteRuleDoc(id: string) {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("rules_docs").delete().eq("id", id).eq("workspace_id", workspaceId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/team/rules");
}

export async function moveRuleDoc(id: string, direction: "up" | "down") {
  const { workspaceId } = await adminProfile();
  const supabase = await createClient();
  const { data: docs } = await supabase
    .from("rules_docs")
    .select("id, position")
    .eq("workspace_id", workspaceId)
    .order("position");
  const list = docs ?? [];
  const idx = list.findIndex((d) => d.id === id);
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;

  const a = list[idx];
  const b = list[swapIdx];
  await Promise.all([
    supabase.from("rules_docs").update({ position: b.position }).eq("id", a.id),
    supabase.from("rules_docs").update({ position: a.position }).eq("id", b.id),
  ]);
  revalidatePath("/app/team/rules");
}

// ---------------------------------------------------------------------------
// Meetings — instance generation, objectives, notes/attendees, held/cancelled
// ---------------------------------------------------------------------------

/** Next date/time (>= now) matching a weekly slot. */
function nextOccurrence(from: Date, dow: number, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(from);
  d.setHours(h, m, 0, 0);
  let daysAhead = (dow - d.getDay() + 7) % 7;
  if (daysAhead === 0 && d <= from) daysAhead = 7;
  d.setDate(d.getDate() + daysAhead);
  return d;
}

/** "Create next instances" — one upcoming row per configured weekly slot, no
 * cron (SPEC §8): admin clicks whenever the next round of meetings is needed.
 * Skips slots that already have a meeting at that exact timestamp. */
export async function createNextMeetingInstances() {
  const { workspaceId } = await adminProfile();
  const schedule = await getSetting(workspaceId, "meeting_schedule");
  if (!schedule.slots.length) return;

  const now = new Date();
  const candidates = schedule.slots.map((slot) => nextOccurrence(now, slot.dow, slot.time).toISOString());

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("meetings")
    .select("scheduled_at")
    .eq("workspace_id", workspaceId)
    .in("scheduled_at", candidates);
  const existingSet = new Set((existing ?? []).map((e) => e.scheduled_at));

  const toInsert = candidates
    .filter((c) => !existingSet.has(c))
    .map((scheduled_at) => ({ workspace_id: workspaceId, scheduled_at }));
  if (toInsert.length) {
    const { error } = await supabase.from("meetings").insert(toInsert);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/app/team/meetings");
}

export async function addObjective(meetingId: string, formData: FormData) {
  await adminProfile();
  const content = z.string().trim().min(1).parse(String(formData.get("content") ?? ""));
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("meeting_objectives")
    .select("position")
    .eq("meeting_id", meetingId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("meeting_objectives")
    .insert({ meeting_id: meetingId, content, position: (last?.position ?? -1) + 1 });
  if (error) throw new Error(error.message);
  revalidatePath(`/app/team/meetings/${meetingId}`);
}

export async function toggleObjective(meetingId: string, objectiveId: string, isDone: boolean) {
  await adminProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_objectives").update({ is_done: isDone }).eq("id", objectiveId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/team/meetings/${meetingId}`);
}

export async function deleteObjective(meetingId: string, objectiveId: string) {
  await adminProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("meeting_objectives").delete().eq("id", objectiveId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/team/meetings/${meetingId}`);
}

export async function saveMeetingNotes(meetingId: string, formData: FormData) {
  await adminProfile();
  const notes = String(formData.get("notes") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ notes }).eq("id", meetingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/team/meetings/${meetingId}`);
}

export async function setAttendees(meetingId: string, formData: FormData) {
  await adminProfile();
  const attendees = formData.getAll("attendees").map(String);
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ attendees }).eq("id", meetingId);
  if (error) throw new Error(error.message);
  revalidatePath(`/app/team/meetings/${meetingId}`);
}

export async function cancelMeeting(meetingId: string) {
  await adminProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ status: "cancelled" }).eq("id", meetingId);
  if (error) throw new Error(error.message);
  revalidatePath("/app/team/meetings");
  revalidatePath(`/app/team/meetings/${meetingId}`);
}

/** Modeled as a return value, not a throw (Next 16 guidance): this is the one
 * DB-trigger error (`guard_meeting_held`, 00005_team.sql) admins are expected
 * to hit in normal use — clicking "mark held" before filling the checklist. */
export async function markMeetingHeld(meetingId: string): Promise<ActionResult> {
  await adminProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ status: "held" }).eq("id", meetingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/team/meetings");
  revalidatePath(`/app/team/meetings/${meetingId}`);
  return { ok: true };
}
