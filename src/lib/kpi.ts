/**
 * Types and thin readers for the SQL KPI contract (migration 00031: kpi_lines /
 * kpi_summary). Every rate and money line is computed in SQL; this file only
 * narrows the jsonb and formats a fraction as a percent. No formula here.
 */
import type { PnlLines } from "@/lib/pricing";

export type KpiMetric = {
  num: number;
  den: number;
  /** fraction 0..1, null when den = 0 */
  value: number | null;
  /** enough decided orders and little still in flight (stop-shipping uses only matured data) */
  matured: boolean;
  /** confirmation only: confirmed / received */
  of_received?: number | null;
};

export type Kpi = {
  confirmation: KpiMetric;
  delivery: KpiMetric;
  return: KpiMetric;
  /** delivered / (confirmed + swapped originals), one order set, never above 1 */
  delivered_of_confirmed: KpiMetric;
  counts: {
    received: number;
    confirmed: number;
    delivered: number;
    returned: number;
    /** swapped originals, counted as returned parcels in the rates (D47) */
    swapped: number;
    in_flight: number;
    on_road_orders: number;
    on_road_units: number;
  };
  /** latest USD rate; null for agents and when no rate exists */
  usd_rate: number | null;
  // money keys: admin only (absent for agents)
  usd_rate_date?: string | null;
  ad_spend_dzd?: number;
  ad_spend_usd?: number | null;
  cost_per_delivered_dzd?: number | null;
  cost_per_delivered_usd?: number | null;
  cpa_delivered_dzd?: number | null;
  cpa_delivered_usd?: number | null;
  roas?: number | null;
  net_profit?: number;
  waterfall?: { revenue: number; cogs: number; returns: number; ads: number; expenses_fixed: number };
  pnl?: PnlLines;
};

/** Narrow an RPC jsonb (`kpi_summary`, `dashboard_stats().kpi`, `pnl_by_product.kpi`). */
export const asKpi = (j: unknown): Kpi | null => (j && typeof j === "object" ? (j as Kpi) : null);

/** A metric as a percent with one decimal (display), or null. */
export const kpiPct = (m: Pick<KpiMetric, "value"> | null | undefined): number | null =>
  m?.value == null ? null : Math.round(m.value * 1000) / 10;

/** ROAS to two decimals (display), or null. */
export const kpiRoas = (k: Kpi | null | undefined): number | null =>
  k?.roas == null ? null : Math.round(k.roas * 100) / 100;

/** Rates of one group (kpi_rates jsonb): the three rates plus counts. No money keys. */
export type KpiGroupRates = Pick<Kpi, "confirmation" | "delivery" | "return" | "counts">;

/** Extras of one group (kpi_group_extras jsonb). Shares are over `shipped`, the delivery-rate denominator. */
export type KpiGroupExtras = {
  shipped: number;
  home_count: number;
  stopdesk_count: number;
  /** delivered non-swapped orders, days from order date; null when none */
  avg_days_to_deliver: number | null;
  avg_days_sample: number;
};

/** One row of `kpi_by_wilaya` / `kpi_by_commune` after narrowing. */
export type KpiGroup = { rates: KpiGroupRates; extras: KpiGroupExtras };

const isObj = (j: unknown): j is Record<string, unknown> => !!j && typeof j === "object";

/** Narrow the `rates` + `extras` jsonb of a group row; null when either is malformed. */
export function asKpiGroup(rates: unknown, extras: unknown): KpiGroup | null {
  if (!isObj(rates) || !isObj(extras) || !isObj(rates.counts) || !isObj(rates.delivery)) return null;
  return { rates: rates as unknown as KpiGroupRates, extras: extras as unknown as KpiGroupExtras };
}
