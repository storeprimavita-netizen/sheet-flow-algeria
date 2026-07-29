"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getProfile, requireAdminProfile } from "@/lib/rbac";
import { CHIP_TOKENS, autoToken } from "@/lib/statuses";
import { getOptionUsageCounts, type OptionSetKey } from "@/lib/option-sets";

export type OptionResult =
  | { ok: true; option: { id: string; label: string; color_token: string } }
  | { ok: false; error: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Repoint every known referencing column from `fromId` to `toId` (order_tags is a join table, handled separately). */
async function repointReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  fromId: string,
  toId: string,
): Promise<string | null> {
  const updates = [
    supabase.from("products").update({ category_option_id: toId }).eq("category_option_id", fromId).eq("workspace_id", workspaceId),
    supabase.from("products").update({ fabric_option_id: toId }).eq("fabric_option_id", fromId).eq("workspace_id", workspaceId),
    supabase.from("expenses").update({ subcategory_option_id: toId }).eq("subcategory_option_id", fromId).eq("workspace_id", workspaceId),
    supabase.from("orders").update({ cancellation_reason_option_id: toId }).eq("cancellation_reason_option_id", fromId).eq("workspace_id", workspaceId),
  ];
  for (const { error } of await Promise.all(updates)) if (error) return error.message;
  return null;
}

function revalidateOptions() {
  revalidatePath("/app/settings/options");
}

/** Inline "+ Create" from any select — any authenticated role (a queue agent may need a reason/tag that doesn't exist yet). */
export async function createOption(setKey: string, label: string): Promise<OptionResult> {
  const profile = await getProfile();
  if (!profile) return { ok: false, error: "Forbidden" };
  const clean = label.trim();
  if (!clean) return { ok: false, error: "Label required" };

  const supabase = await createClient();
  const { data: set } = await supabase
    .from("option_sets")
    .select("id")
    .eq("workspace_id", profile.workspaceId)
    .eq("key", setKey)
    .maybeSingle();
  if (!set) return { ok: false, error: "Unknown option set" };

  const { data: dupe } = await supabase.from("options").select("id").eq("set_id", set.id).ilike("label", clean).maybeSingle();
  if (dupe) return { ok: false, error: "Already exists" };

  const { count } = await supabase.from("options").select("id", { count: "exact", head: true }).eq("set_id", set.id);
  const { data, error } = await supabase
    .from("options")
    .insert({
      workspace_id: profile.workspaceId,
      set_id: set.id,
      label: clean,
      color_token: autoToken(clean),
      sort_order: count ?? 0,
    })
    .select("id, label, color_token")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidateOptions();
  return { ok: true, option: data };
}

export async function renameOption(id: string, label: string): Promise<ActionResult> {
  const { workspaceId } = await requireAdminProfile();
  const clean = label.trim();
  if (!clean) return { ok: false, error: "Label required" };
  const supabase = await createClient();
  const { error } = await supabase.from("options").update({ label: clean }).eq("id", id).eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidateOptions();
  return { ok: true };
}

export async function recolorOption(id: string, colorToken: string): Promise<ActionResult> {
  const { workspaceId } = await requireAdminProfile();
  const parsed = z.enum(CHIP_TOKENS as [string, ...string[]]).safeParse(colorToken);
  if (!parsed.success) return { ok: false, error: "Invalid color" };
  const supabase = await createClient();
  const { error } = await supabase.from("options").update({ color_token: parsed.data }).eq("id", id).eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidateOptions();
  return { ok: true };
}

export async function setOptionArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("options")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidateOptions();
  return { ok: true };
}

/** Swap sort_order with the previous/next sibling in the same set. */
export async function moveOption(id: string, direction: "up" | "down"): Promise<ActionResult> {
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();
  const { data: current } = await supabase.from("options").select("set_id").eq("id", id).eq("workspace_id", workspaceId).maybeSingle();
  if (!current) return { ok: false, error: "Not found" };

  const { data: siblings } = await supabase
    .from("options")
    .select("id, sort_order")
    .eq("set_id", current.set_id)
    .eq("workspace_id", workspaceId)
    .order("sort_order");
  const list = siblings ?? [];
  const i = list.findIndex((o) => o.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= list.length) return { ok: true }; // already at the edge

  const [a, b] = [list[i], list[j]];
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from("options").update({ sort_order: b.sort_order }).eq("id", a.id),
    supabase.from("options").update({ sort_order: a.sort_order }).eq("id", b.id),
  ]);
  if (e1 || e2) return { ok: false, error: (e1 ?? e2)!.message };
  revalidateOptions();
  return { ok: true };
}

/** Repoint every reference from `fromId` to `toId`, then delete `fromId`. Both must be in the same set. */
export async function mergeOption(fromId: string, toId: string): Promise<ActionResult> {
  const { workspaceId } = await requireAdminProfile();
  if (fromId === toId) return { ok: false, error: "Pick a different option" };
  const supabase = await createClient();

  const [{ data: from }, { data: to }] = await Promise.all([
    supabase.from("options").select("set_id").eq("id", fromId).eq("workspace_id", workspaceId).maybeSingle(),
    supabase.from("options").select("set_id").eq("id", toId).eq("workspace_id", workspaceId).maybeSingle(),
  ]);
  if (!from || !to) return { ok: false, error: "Not found" };
  if (from.set_id !== to.set_id) return { ok: false, error: "Options must be in the same set" };

  const repointError = await repointReferences(supabase, workspaceId, fromId, toId);
  if (repointError) return { ok: false, error: repointError };

  const { data: tagRows } = await supabase.from("order_tags").select("order_id").eq("option_id", fromId).eq("workspace_id", workspaceId);
  if (tagRows && tagRows.length) {
    const { error } = await supabase
      .from("order_tags")
      .upsert(
        tagRows.map((r) => ({ order_id: r.order_id, option_id: toId, workspace_id: workspaceId })),
        { onConflict: "order_id,option_id", ignoreDuplicates: true },
      );
    if (error) return { ok: false, error: error.message };
  }
  await supabase.from("order_tags").delete().eq("option_id", fromId).eq("workspace_id", workspaceId);

  const { error: delError } = await supabase.from("options").delete().eq("id", fromId).eq("workspace_id", workspaceId);
  if (delError) return { ok: false, error: delError.message };
  revalidateOptions();
  return { ok: true };
}

/** Hard delete — only offered (and only succeeds) when the option is unused. */
export async function deleteOption(id: string, setKey: OptionSetKey): Promise<ActionResult> {
  const { workspaceId } = await requireAdminProfile();
  const counts = await getOptionUsageCounts(workspaceId, setKey);
  if ((counts[id] ?? 0) > 0) return { ok: false, error: "In use — merge or archive instead" };
  const supabase = await createClient();
  const { error } = await supabase.from("options").delete().eq("id", id).eq("workspace_id", workspaceId);
  if (error) return { ok: false, error: error.message };
  revalidateOptions();
  return { ok: true };
}
