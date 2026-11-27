import { parseOrderSeqQuery } from "@/lib/order-search";
import { algiersDayStart } from "@/lib/my-day";
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

/** Added to the Confirmation select for `confirmed_today`: an inner embed filters parents without duplicating them. */
export const CONFIRMED_EVENT_SELECT = ", confirmed_event:order_status_history!inner(id)";

type Sliceable<Q> = Filterable<Q> & {
  is(column: string, value: null): Q;
  not(column: string, operator: "is", value: null): Q;
  lt(column: string, value: string): Q;
};

/**
 * CONF-4 Confirmation-only queue slices, applied before any limit.
 * `callbacks_due` also needs the page's actionable status gate and the `zr` embed;
 * `confirmed_today` needs CONFIRMED_EVENT_SELECT and replaces that gate.
 */
export function applyQueueSlice<Q extends Sliceable<Q>>(query: Q, slice: NonNullable<ViewConfig["queue_slice"]>, now: Date): Q {
  if (slice === "callbacks_due") {
    return query.eq("delivery_status", "wait_for_deposit").is("zr", null).lte("callback_at", now.toISOString());
  }
  const start = algiersDayStart(now);
  const next = new Date(Date.parse(start) + 86_400_000).toISOString();
  return query
    .eq("confirmation_status", "confirmed")
    .eq("confirmed_event.stage", "confirmation")
    .not("confirmed_event.from_status", "is", null)
    .eq("confirmed_event.to_status", "confirmed")
    .gte("confirmed_event.created_at", start)
    .lt("confirmed_event.created_at", next);
}

/** Allow-listed sort: unknown falls back to newest first. */
export function orderSort(cfg: ViewConfig): { column: string; ascending: boolean } {
  const column = (cfg.sort && SORT_COLUMNS[cfg.sort]) || "created_at";
  return { column, ascending: column === "created_at" ? false : cfg.dir !== "desc" };
}

/** Supabase returns at most this many rows when a page has no range. */
export const ROW_LIMIT = 1000;
