"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminProfile as adminProfile } from "@/lib/rbac";
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

  revalidatePath("/app/settings/users");
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

  revalidatePath("/app/settings/users");
  return { ok: true };
}
