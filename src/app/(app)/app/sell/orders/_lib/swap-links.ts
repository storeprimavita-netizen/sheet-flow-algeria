import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type SwapTo = { id: string; orderSeq: number };

/** One query for all replacements of the linked originals on a page (no N+1). Keyed by original id. */
export async function swapTargets(
  supabase: SupabaseClient<Database>,
  rows: { id: string; swapped_to_order_id: string | null }[],
): Promise<Map<string, SwapTo>> {
  const ids = [...new Set(rows.map((r) => r.swapped_to_order_id).filter((v): v is string => !!v))];
  const out = new Map<string, SwapTo>();
  if (!ids.length) return out;
  const byId = new Map<string, SwapTo>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from("orders").select("id, order_seq").in("id", ids.slice(i, i + 100));
    if (error) console.error("swapTargets", error.message);
    for (const b of data ?? []) byId.set(b.id, { id: b.id, orderSeq: b.order_seq });
  }
  for (const r of rows) {
    const b = r.swapped_to_order_id ? byId.get(r.swapped_to_order_id) : undefined;
    if (b) out.set(r.id, b);
  }
  return out;
}
