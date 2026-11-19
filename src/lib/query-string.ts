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
};

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
  for (const [k, v] of Object.entries(extra)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  return `/app/orders/all?${params.toString()}`;
}

/** Reserved `commune` value in a drill link: the orders whose commune is empty (`is null` key). */
export const UNKNOWN_COMMUNE = "__unknown";

/** Drill kinds of `/app/orders/all`: the exact orders behind a statistics count (SQL `kpi_drill_orders`). */
export const DRILL_KINDS = ["received", "confirmed", "delivered", "returned", "shipped"] as const;
export type DrillKind = (typeof DRILL_KINDS)[number];

/** Link to the orders behind one statistics count. `communeKey` null = unknown commune. */
export function drillQs(
  filters: DashboardFilters,
  d: { kind: DrillKind; wilaya: number; communeKey?: string | null; deliveryType?: "home" | "stopdesk" },
): string {
  const extra: Record<string, string | undefined> = {
    kind: d.kind,
    wilaya_code: String(d.wilaya),
    delivery_type: d.deliveryType,
  };
  if (d.communeKey !== undefined) extra.commune = d.communeKey ?? UNKNOWN_COMMUNE;
  return ordersQs({ from: filters.from, to: filters.to, product: filters.product }, extra);
}
