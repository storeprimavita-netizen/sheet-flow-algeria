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

/** Rates of one group (wilaya / commune): `kpi_rates` output, as `kpi_by_wilaya` returns it. */
export type GroupRates = Pick<Kpi, "confirmation" | "delivery" | "return"> & {
  counts: { received: number; confirmed: number; delivered: number; returned: number; swapped: number };
};

/** Extras of one group (migration 00058 `kpi_group_extras`); shares are over `shipped`. */
export type GroupExtras = {
  shipped: number;
  home_count: number;
  stopdesk_count: number;
  /** null when no delivered non-swapped order has a delivery history entry */
  avg_days_to_deliver: number | null;
  avg_days_sample: number;
};

export type WilayaStat = { code: number | null; name: string | null; rates: GroupRates; extras: GroupExtras };
export type CommuneStat = { key: string | null; name: string | null; rates: GroupRates; extras: GroupExtras };

type RawWilaya = { wilaya_code: number | null; wilaya_name: string | null; rates: unknown; extras: unknown };
type RawCommune = { commune_key: string | null; commune: string | null; rates: unknown; extras: unknown };

/** Narrow `kpi_by_wilaya` rows; biggest wilaya first. */
export function asWilayaStats(rows: unknown): WilayaStat[] {
  return ((rows ?? []) as RawWilaya[])
    .map((r) => ({ code: r.wilaya_code, name: r.wilaya_name, rates: r.rates as GroupRates, extras: r.extras as GroupExtras }))
    .sort((a, b) => b.rates.counts.received - a.rates.counts.received || (a.code ?? 0) - (b.code ?? 0));
}

/** Narrow `kpi_by_commune` rows; biggest commune first, unknown (null key) last on ties. */
export function asCommuneStats(rows: unknown): CommuneStat[] {
  return ((rows ?? []) as RawCommune[])
    .map((r) => ({ key: r.commune_key, name: r.commune, rates: r.rates as GroupRates, extras: r.extras as GroupExtras }))
    .sort((a, b) => b.rates.counts.received - a.rates.counts.received || (a.name ?? "~").localeCompare(b.name ?? "~"));
}
