import "server-only";

import { createClient } from "@/lib/supabase/server";
import { parseViewConfig, parseViewId, type OrderViewDto, type ViewScope } from "@/lib/order-views";

export type ViewsResult = { views: OrderViewDto[]; error?: undefined } | { views: OrderViewDto[]; error: string };

/** Shared first, then personal, each by position. RLS already limits rows to shared + own. */
export async function listViews(scope: ViewScope): Promise<ViewsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_views")
    .select("id, name, emoji, scope, seed_key, owner_id, position, layout, config, created_at")
    .eq("scope", scope)
    .order("position")
    .order("created_at");
  if (error) {
    console.error("order_views", error.message);
    return { views: [], error: error.message };
  }
  const views: OrderViewDto[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    emoji: r.emoji,
    scope: r.scope as ViewScope,
    seed_key: r.seed_key,
    shared: r.owner_id === null,
    position: r.position,
    layout: r.layout === "kanban" ? "kanban" : "table",
    config: parseViewConfig(r.config),
  }));
  views.sort((a, b) => Number(b.shared) - Number(a.shared) || a.position - b.position);
  return { views };
}

/**
 * Resolve `?view`: valid uuid, in this scope's visible list (shared or own).
 * `invalid` is true when a param was given but cannot be used (no existence leak).
 */
export function resolveView(
  views: OrderViewDto[],
  param: string | string[] | undefined,
  scope?: ViewScope,
): { active: OrderViewDto | null; invalid: boolean } {
  if (param === undefined || param === "" || (scope === "shipping" && param === "kanban")) {
    return { active: null, invalid: false };
  }
  const id = parseViewId(param);
  const active = id ? (views.find((v) => v.id === id) ?? null) : null;
  return { active, invalid: !active };
}
