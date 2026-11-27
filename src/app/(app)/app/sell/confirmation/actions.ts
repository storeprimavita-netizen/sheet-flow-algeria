"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { algiersToIso } from "./_lib/callback";

const ATTEMPT_LIMIT = 10;

const callbackSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("schedule"), orderId: z.uuid(), date: z.string().max(10), time: z.string().max(5) }),
  z.object({ op: z.literal("clear"), orderId: z.uuid() }),
]);

export type CallbackResult = { ok: true } | { ok: false; error: "invalid" | "past" | "locked" | "forbidden" | "failed" };

async function caller() {
  const profile = await getProfile();
  return profile && (profile.role === "admin" || profile.role === "confirmation_agent") ? profile : null;
}

export async function saveCallback(input: unknown): Promise<CallbackResult> {
  const parsed = callbackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  let at: string | null = null;
  if (parsed.data.op === "schedule") {
    at = algiersToIso(parsed.data.date, parsed.data.time);
    if (!at) return { ok: false, error: "invalid" };
    if (Date.parse(at) <= Date.now()) return { ok: false, error: "past" };
  }
  if (!(await caller())) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  // the generated type has no null; an explicit null is the RPC's "clear"
  const { error } = await supabase.rpc("set_order_callback", {
    p_order_id: parsed.data.orderId,
    p_callback_at: at as string,
  });
  if (error) {
    const known = { "42501": "forbidden", "55000": "locked", "22023": "past" } as const;
    return { ok: false, error: known[error.code as keyof typeof known] ?? "failed" };
  }
  revalidatePath("/app/sell/confirmation");
  revalidatePath(`/app/sell/orders/${parsed.data.orderId}`);
  return { ok: true };
}

export type Attempt = {
  id: string;
  at: string;
  outcome: "no_answer" | "closed_phone";
  /** `system`: no actor recorded; `unknown`: an actor whose name cannot be shown */
  actor: { kind: "user"; name: string } | { kind: "system" | "unknown" };
};
export type AttemptsResult = { ok: true; attempts: Attempt[]; more: boolean } | { ok: false };

/** The latest recorded no-answer / closed-phone transitions of one visible order, oldest first. */
export async function loadAttempts(orderId: unknown): Promise<AttemptsResult> {
  const id = z.uuid().safeParse(orderId);
  if (!id.success) return { ok: false };
  const profile = await caller();
  if (!profile) return { ok: false };
  const supabase = await createClient();

  const order = await supabase.from("orders").select("id")
    .eq("id", id.data).eq("workspace_id", profile.workspaceId).maybeSingle();
  if (order.error || !order.data) return { ok: false };

  const { data, error } = await supabase.from("order_status_history")
    .select("id, to_status, actor, created_at")
    .eq("order_id", id.data)
    .eq("stage", "confirmation")
    .not("from_status", "is", null)
    .in("to_status", ["no_answer", "closed_phone"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(ATTEMPT_LIMIT + 1);
  if (error) return { ok: false };

  const rows = data.slice(0, ATTEMPT_LIMIT).reverse();
  const actorIds = [...new Set(rows.flatMap((row) => (row.actor ? [row.actor] : [])))];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const profiles = await supabase.from("profiles").select("user_id, display_name")
      .eq("workspace_id", profile.workspaceId).in("user_id", actorIds);
    if (profiles.error) return { ok: false };
    for (const p of profiles.data) if (p.display_name) names.set(p.user_id, p.display_name);
  }

  return {
    ok: true,
    more: data.length > ATTEMPT_LIMIT,
    attempts: rows.map((row) => {
      const name = row.actor ? names.get(row.actor) : undefined;
      return {
        id: String(row.id),
        at: row.created_at,
        outcome: row.to_status as Attempt["outcome"],
        actor: !row.actor ? { kind: "system" } : name ? { kind: "user", name } : { kind: "unknown" },
      };
    }),
  };
}
