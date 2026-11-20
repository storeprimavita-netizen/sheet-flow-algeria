/**
 * Reads for option_sets/options (see supabase/migrations/00014_option_sets.sql
 * and .claude/skills/cod-ui-polish/references/option-sets.md). Mutations live
 * in `option-sets-actions.ts` ("use server" — can't share this file, which
 * exports plain async helpers too).
 */
import { createClient } from "@/lib/supabase/server";
import type { StatusToken } from "@/lib/statuses";

export type OptionRow = {
  id: string;
  label: string;
  color_token: StatusToken;
  icon: string | null;
  emoji: string | null;
  sort_order: number;
  archived_at: string | null;
};

export const OPTION_SET_KEYS = [
  "product_category",
  "product_fabric",
  "expense_subcategory",
  "order_tag",
  "cancellation_reason",
] as const;
export type OptionSetKey = (typeof OPTION_SET_KEYS)[number];

/** All options for a set (including archived — callers decide how to render those), sort_order ascending. */
export async function getOptionSet(workspaceId: string, key: OptionSetKey): Promise<OptionRow[]> {
  const supabase = await createClient();
  const { data: set } = await supabase
    .from("option_sets")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("key", key)
    .maybeSingle();
  if (!set) return [];
  const { data } = await supabase
    .from("options")
    .select("id, label, color_token, icon, emoji, sort_order, archived_at")
    .eq("set_id", set.id)
    .order("sort_order");
  return (data ?? []) as OptionRow[];
}

/** Every set + its options, for the Settings → Options management screen. */
export async function getAllOptionSets(
  workspaceId: string,
): Promise<{ id: string; key: OptionSetKey; label: string; allowsMulti: boolean; options: OptionRow[] }[]> {
  const supabase = await createClient();
  const { data: sets } = await supabase
    .from("option_sets")
    .select("id, key, label, allows_multi")
    .eq("workspace_id", workspaceId)
    .order("label");
  const results = await Promise.all(
    (sets ?? []).map(async (s) => ({
      id: s.id,
      key: s.key as OptionSetKey,
      label: s.label,
      allowsMulti: s.allows_multi,
      options: await getOptionSet(workspaceId, s.key as OptionSetKey),
    })),
  );
  return results;
}

/** id -> usage count, for the one known consumer column each set has (no generic polymorphic counter — 5 fixed sets). */
export async function getOptionUsageCounts(workspaceId: string, key: OptionSetKey): Promise<Record<string, number>> {
  const supabase = await createClient();
  let ids: (string | null)[] = [];
  switch (key) {
    case "product_category": {
      const { data } = await supabase.from("products").select("category_option_id").eq("workspace_id", workspaceId);
      ids = (data ?? []).map((r) => r.category_option_id);
      break;
    }
    case "product_fabric": {
      const { data } = await supabase.from("products").select("fabric_option_id").eq("workspace_id", workspaceId);
      ids = (data ?? []).map((r) => r.fabric_option_id);
      break;
    }
    case "expense_subcategory": {
      const { data } = await supabase.from("expenses").select("subcategory_option_id").eq("workspace_id", workspaceId);
      ids = (data ?? []).map((r) => r.subcategory_option_id);
      break;
    }
    case "cancellation_reason": {
      const { data } = await supabase.from("orders").select("cancellation_reason_option_id").eq("workspace_id", workspaceId);
      ids = (data ?? []).map((r) => r.cancellation_reason_option_id);
      break;
    }
    case "order_tag": {
      const { data } = await supabase.from("order_tags").select("option_id").eq("workspace_id", workspaceId);
      ids = (data ?? []).map((r) => r.option_id);
      break;
    }
  }
  const counts: Record<string, number> = {};
  for (const id of ids) if (id) counts[id] = (counts[id] ?? 0) + 1;
  return counts;
}
