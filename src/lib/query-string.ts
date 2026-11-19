import { DELIVERY_TYPES, ORDER_SOURCES } from "@/lib/enums";

/**
 * Builds a `?from=&to=&...` query string for drill-through links. Plain
 * server-safe helper — NOT in a `"use client"` file, so server components can
 * call it directly (Next 16 refuses to invoke a function exported from a
 * client module, even a pure one, from server code).
 */
export function financeQs(dateRange: { from?: string; to?: string }, extra: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (dateRange.from) params.set("from", dateRange.from);
  if (dateRange.to) params.set("to", dateRange.to);
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  return `?${params.toString()}`;
}

export type DashboardFilters = {
  from?: string;
  to?: string;
  product?: string;
  wilaya?: string;
  source?: string;
  agent?: string;
  confirmation_status?: string;
  delivery_status?: string;
  /** Statistics drill only: option uuid (`/app/orders/all?category=`), compared like `kpi_order_set`. */
  category?: string;
  /** Statistics drill only: confirmation agent only (`conf_agent`); `agent` keeps its confirmation-OR-delivery meaning. */
  conf_agent?: string;
  delivery_type?: string;
};

/** One date shape for every statistics/drill param (an invalid value is dropped, never half-applied). */
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** ISO shape AND a real calendar day (2026-02-30 is rejected, never rolled over to March). */
export function isRealIsoDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
/** Longest commune key accepted by the drill (longer is rejected, never cut). */
export const MAX_COMMUNE_KEY = 120;
/** A commune key can be a drill link only when the drill would accept it. */
export const communeLinkable = (key: string) => key.length <= MAX_COMMUNE_KEY;
/** Banner text for a commune drill: the original spelling only when it is the same commune as the key
 * (lower(trim)); a mismatching label in a shared link falls back to the key. */
export const communeBannerLabel = (key: string, label: string) =>
  label.trim().toLowerCase() === key ? label.trim() : key;
/** Params that only exist in statistics drill mode (the key filters are DRILL_FILTER_KEYS); any other filter change removes them all. */
export const DRILL_PARAMS = ["drill", "commune_key", "commune_unknown", "commune_label"] as const;
/** `commune_unknown=1` on /app/orders/all means "no commune" (`is null`); it is a separate param so it can never collide with a real key (lower(trim(commune))). */
export const COMMUNE_UNKNOWN_PARAM = "commune_unknown";

/**
 * `/app/orders/all`'s URL-param shape (product_id/wilaya_code/agent/…). Takes
 * a plain filters object rather than a closure so client components (e.g. the
 * choropleth's hover/click) can call it directly instead of receiving a
 * function prop from a server component (RSC forbids that).
 */
export function ordersQs(filters: DashboardFilters, extra: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.product) params.set("product_id", filters.product);
  if (filters.wilaya) params.set("wilaya_code", filters.wilaya);
  if (filters.source) params.set("source", filters.source);
  if (filters.agent) params.set("agent", filters.agent);
  if (filters.confirmation_status) params.set("confirmation_status", filters.confirmation_status);
  if (filters.delivery_status) params.set("delivery_status", filters.delivery_status);
  if (filters.category) params.set("category", filters.category);
  if (filters.conf_agent) params.set("conf_agent", filters.conf_agent);
  if (filters.delivery_type) params.set("delivery_type", filters.delivery_type);
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  return `/app/orders/all?${params.toString()}`;
}

/** Drill metric -> the orders behind a /app/statistics count (`kpi_drill_orders`, same predicate as the SQL count). */
export type DrillMetric = "received" | "confirmed" | "delivered" | "return" | "shipped";

/** `/app/orders/all` drill link: same period/product, one wilaya, optionally one commune key (communeKey null = no commune). */
export const drillHref = (
  filters: DashboardFilters,
  metric: DrillMetric,
  extra: { wilaya: number; communeKey?: string | null; communeLabel?: string; deliveryType?: string },
) =>
  ordersQs(filters, {
    ...(extra.deliveryType ? { delivery_type: extra.deliveryType } : {}),
    commune_label: extra.communeLabel,
    drill: metric,
    wilaya_code: String(extra.wilaya),
    // communeKey === null -> the "no commune" group; undefined -> the whole wilaya
    commune_key: extra.communeKey ?? undefined,
    [COMMUNE_UNKNOWN_PARAM]: extra.communeKey === null ? "1" : undefined,
  });

// ---------------------------------------------------------------------------
// /app/statistics URL state (STATS-3). Param names:
//   from, to            explicit period (wins over a season; the chip then shows "overridden")
//   season, year        a season (uuid) and one of its years
//   product             product uuid
//   f_category          product_category option uuid      -> kpi filter `category`
//   f_wilaya            wilaya code 1-58                  -> kpi filter `wilaya`
//   f_source            order source                      -> kpi filter `source`
//   f_agent             confirmation agent uuid           -> kpi filter `agent`
//   f_delivery          home | stopdesk                   -> kpi filter `delivery_type`
//   wilaya              the OPEN drill panel (not a filter; never persisted)
// ---------------------------------------------------------------------------
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type StatsFilters = {
  from?: string;
  to?: string;
  product?: string;
  season?: string;
  year?: number;
  category?: string;
  wilaya?: string;
  source?: string;
  agent?: string;
  delivery?: string;
};

/** Raw URL -> typed filters. Anything invalid is dropped (never half-applied); uuids are lowercased. */
export function parseStatsFilters(get: (k: string) => string): StatsFilters {
  const uuid = (k: string) => {
    const v = get(k).toLowerCase();
    return UUID_RE.test(v) ? v : undefined;
  };
  const wilaya = get("f_wilaya");
  const year = get("year");
  const out: StatsFilters = {
    from: isRealIsoDate(get("from")) ? get("from") : undefined,
    to: isRealIsoDate(get("to")) ? get("to") : undefined,
    product: uuid("product"),
    season: uuid("season"),
    year: /^\d{4}$/.test(year) ? Number(year) : undefined,
    category: uuid("f_category"),
    wilaya: /^\d{1,2}$/.test(wilaya) && Number(wilaya) >= 1 && Number(wilaya) <= 58 ? String(Number(wilaya)) : undefined,
    source: (ORDER_SOURCES as readonly string[]).includes(get("f_source")) ? get("f_source") : undefined,
    agent: uuid("f_agent"),
    delivery: (DELIVERY_TYPES as readonly string[]).includes(get("f_delivery")) ? get("f_delivery") : undefined,
  };
  return out;
}

/** Typed filters -> canonical URL params (the inverse of parseStatsFilters; only valid values). */
export function statsFiltersToParams(f: StatsFilters): URLSearchParams {
  const p = new URLSearchParams();
  const put = (k: string, v: string | number | undefined) => { if (v !== undefined && v !== "") p.set(k, String(v)); };
  put("from", f.from); put("to", f.to); put("product", f.product); put("season", f.season); put("year", f.year);
  put("f_category", f.category); put("f_wilaya", f.wilaya); put("f_source", f.source);
  put("f_agent", f.agent); put("f_delivery", f.delivery);
  return p;
}

/** The `p_filters` jsonb of kpi_order_set / kpi_by_* / kpi_drill_orders / kpi_set_rates (undefined = none). */
export function kpiFiltersJson(f: StatsFilters): Record<string, string> | undefined {
  const j: Record<string, string> = {};
  if (f.category) j.category = f.category;
  if (f.wilaya) j.wilaya = f.wilaya;
  if (f.source) j.source = f.source;
  if (f.agent) j.agent = f.agent;
  if (f.delivery) j.delivery_type = f.delivery;
  return Object.keys(j).length ? j : undefined;
}

/** Statistics filters -> the drill-link filter shape (`ordersQs`). `wilaya` is the open row's, set by `drillHref`. */
export function statsDrillFilters(f: StatsFilters, range: { from?: string; to?: string }): DashboardFilters {
  return {
    from: range.from,
    to: range.to,
    product: f.product,
    source: f.source,
    category: f.category,
    conf_agent: f.agent,
    delivery_type: f.delivery,
  };
}

/** Keys the Statistics bar remembers in localStorage (`mnw:statsFilters`). Never the drill `wilaya`. */
export const STATS_PERSIST_KEYS = ["from", "to", "product", "season", "year", "f_category", "f_wilaya", "f_source", "f_agent", "f_delivery"] as const;
/** Keys the Dashboard bar may restore: its own three. Stats keys in an old/shared value are ignored. */
export const DASHBOARD_PERSIST_KEYS = ["from", "to", "product"] as const;

/** Allow-list a query string; `year` survives only with a `season`. */
export function pickParams(qs: string, keys: readonly string[]): string {
  const src = new URLSearchParams(qs);
  const out = new URLSearchParams();
  for (const k of keys) {
    const v = src.get(k);
    if (v) out.set(k, v);
  }
  if (!out.get("season")) out.delete("year");
  return out.toString();
}
