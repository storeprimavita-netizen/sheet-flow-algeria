import { parseOrderSeqQuery } from "@/lib/order-search";
import { cleanQuery, SORT_COLUMNS, type ViewConfig } from "@/lib/order-views";

/** The slice of the PostgREST builder this file uses (keeps the helper generic over select shapes). */
type Filterable<Q> = {
  eq(column: string, value: string | number | boolean): Q;
  in(column: string, values: readonly string[]): Q;
  or(filters: string): Q;
  gte(column: string, value: string): Q;
  lte(column: string, value: string): Q;
};

/**
 * ONE filter builder for the all / confirmation / delivery order pages.
 * Every value comes from a validated ViewConfig (uuid, enum, int, ISO date);
 * the page applies its own fixed filter AFTER this so a view can only narrow.
 */
export function applyOrderConfig<Q extends Filterable<Q>>(query: Q, cfg: ViewConfig): Q {
  let q = query;
  if (cfg.confirmation_status) q = q.in("confirmation_status", cfg.confirmation_status);
  if (cfg.delivery_status) q = q.eq("delivery_status", cfg.delivery_status);
  if (cfg.product_id) q = q.eq("product_id", cfg.product_id);
  if (cfg.wilaya_code) q = q.eq("wilaya_code", cfg.wilaya_code);
  if (cfg.source) q = q.eq("source", cfg.source);
  if (cfg.duplicates) q = q.eq("is_duplicate_suspect", true);
  if (cfg.agent) q = q.or(`assigned_confirmation_agent.eq.${cfg.agent},assigned_delivery_agent.eq.${cfg.agent}`);
  const text = cfg.q ? cleanQuery(cfg.q) : "";
  if (cfg.q) {
    const raw = cfg.q.trim();
    const seq = parseOrderSeqQuery(raw);
    if (seq !== null) {
      const digits = raw.replace(/\D/g, "");
      // 5+ digits may be a partial phone number as well as a running number.
      q = digits.length >= 5
        ? q.or(`order_seq.eq.${seq},customer_phone.ilike.%${digits}%`)
        : q.eq("order_seq", seq);
    } else if (text) {
      q = q.or(`customer_name.ilike.%${text}%,customer_phone.ilike.%${text}%,order_number.ilike.%${text}%`);
    }
  }
  if (cfg.from) q = q.gte("placed_at", cfg.from);
  if (cfg.to) q = q.lte("placed_at", `${cfg.to}T23:59:59`);
  return q;
}

/** Allow-listed sort: unknown falls back to newest first. */
export function orderSort(cfg: ViewConfig): { column: string; ascending: boolean } {
  const column = (cfg.sort && SORT_COLUMNS[cfg.sort]) || "created_at";
  return { column, ascending: column === "created_at" ? false : cfg.dir !== "desc" };
}

/** Supabase returns at most this many rows when a page has no range. */
export const ROW_LIMIT = 1000;
