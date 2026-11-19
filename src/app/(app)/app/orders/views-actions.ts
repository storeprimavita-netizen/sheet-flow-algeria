"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { Json, TablesUpdate } from "@/lib/supabase/database.types";
import { getProfile } from "@/lib/rbac";
import {
  MAX_VIEWS_PER_GROUP,
  parseViewConfig,
  VIEW_SCOPES,
  viewInputSchema,
} from "@/lib/order-views";

/** Last write wins: two people editing the same view overwrite each other (no version check). */
export type ViewResult =
  | { ok: true; id: string }
  | { ok: false; error: "invalid" | "forbidden" | "duplicateName" | "capReached" | "notFound" | "failed" };

const idSchema = z.string().uuid();
const createSchema = viewInputSchema.and(
  z.object({
    scope: z.enum(VIEW_SCOPES),
    shared: z.boolean(),
    config: z.unknown(),
  }),
);
const DUPLICATE = "23505";

async function who() {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  const profile = user ? await getProfile() : null;
  return { supabase, user, profile };
}

function refresh() {
  for (const p of ["all", "confirmation", "delivery"]) revalidatePath(`/app/orders/${p}`);
}

function fail(error: { code?: string; message?: string } | null): ViewResult {
  if (error?.code === DUPLICATE) return { ok: false, error: "duplicateName" };
  // DB cap trigger (00057) backs up the check in createView
  if (error?.code === "23514" && error.message?.includes("limit")) return { ok: false, error: "capReached" };
  return { ok: false, error: "failed" };
}

export async function createView(input: unknown): Promise<ViewResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { supabase, user, profile } = await who();
  if (!user || !profile) return { ok: false, error: "forbidden" };
  const { name, emoji, scope, shared } = parsed.data;
  if (shared && profile.role !== "admin") return { ok: false, error: "forbidden" };
  const config = parseViewConfig(parsed.data.config) as NonNullable<Json>;

  let count = supabase.from("order_views").select("position", { count: "exact" }).eq("scope", scope);
  count = shared ? count.is("owner_id", null) : count.eq("owner_id", user.id);
  const { data: existing, count: n, error: countError } = await count.order("position", { ascending: false }).limit(1);
  if (countError) return { ok: false, error: "failed" };
  if ((n ?? 0) >= MAX_VIEWS_PER_GROUP) return { ok: false, error: "capReached" };

  const { data, error } = await supabase
    .from("order_views")
    .insert({
      workspace_id: profile.workspaceId,
      owner_id: shared ? null : user.id,
      name,
      emoji,
      scope,
      config,
      position: (existing?.[0]?.position ?? -1) + 1,
    })
    .select("id");
  if (error) return fail(error);
  if (data?.length !== 1) return { ok: false, error: "forbidden" };
  refresh();
  return { ok: true, id: data[0].id };
}

/** Exactly one row must change: RLS turns a forbidden write into 0 rows, not an error. */
async function updateOne(id: string, patch: TablesUpdate<"order_views">): Promise<ViewResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase, user } = await who();
  if (!user) return { ok: false, error: "forbidden" };
  const { data, error } = await supabase.from("order_views").update(patch).eq("id", id).select("id");
  if (error) return fail(error);
  if (data?.length !== 1) return { ok: false, error: "notFound" };
  refresh();
  return { ok: true, id };
}

export async function saveView(id: string, config: unknown): Promise<ViewResult> {
  return updateOne(id, { config: parseViewConfig(config) as NonNullable<Json> });
}

export async function renameView(id: string, input: unknown): Promise<ViewResult> {
  const parsed = viewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  return updateOne(id, { name: parsed.data.name, emoji: parsed.data.emoji });
}

export async function deleteView(id: string): Promise<ViewResult> {
  if (!idSchema.safeParse(id).success) return { ok: false, error: "invalid" };
  const { supabase, user } = await who();
  if (!user) return { ok: false, error: "forbidden" };
  const { data, error } = await supabase.from("order_views").delete().eq("id", id).select("id");
  if (error) return fail(error);
  if (data?.length !== 1) return { ok: false, error: "notFound" };
  refresh();
  return { ok: true, id };
}

/** Move one step earlier/later inside its own group (shared or personal); positions are renumbered 0..n. */
export async function moveView(id: string, direction: "earlier" | "later"): Promise<ViewResult> {
  if (!idSchema.safeParse(id).success || (direction !== "earlier" && direction !== "later")) {
    return { ok: false, error: "invalid" };
  }
  const { supabase, user } = await who();
  if (!user) return { ok: false, error: "forbidden" };
  const { data: row } = await supabase.from("order_views").select("scope, owner_id").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "notFound" };
  let group = supabase.from("order_views").select("id, position").eq("scope", row.scope);
  group = row.owner_id === null ? group.is("owner_id", null) : group.eq("owner_id", row.owner_id);
  const { data: rows, error } = await group.order("position").order("created_at");
  if (error || !rows) return { ok: false, error: "failed" };
  const ids = rows.map((r) => r.id);
  const current = new Map(rows.map((r) => [r.id, r.position]));
  const i = ids.indexOf(id);
  const j = direction === "earlier" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= ids.length) return { ok: true, id };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (let p = 0; p < ids.length; p++) {
    if (current.get(ids[p]) === p) continue; // only rows that actually move are written
    const { data, error: e } = await supabase.from("order_views").update({ position: p }).eq("id", ids[p]).select("id");
    if (e) return fail(e);
    if (data?.length !== 1) return { ok: false, error: "forbidden" };
  }
  refresh();
  return { ok: true, id };
}
