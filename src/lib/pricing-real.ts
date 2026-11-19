import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { asKpi, type Kpi } from "@/lib/kpi";
import type { ScenarioInput } from "@/lib/pricing-v2";

export type RealScenario = { input: ScenarioInput; adCostDzd: number | null; hasData: boolean; matured: boolean };

/**
 * Pure mapping of the SQL KPI contract (D4/D46/D47, D67) onto engine inputs for the
 * read-only "Real" column. No rate is re-derived: confirmation (confirmed / answered)
 * and delivery (delivered / parcels with a final result) are the SQL `value`s with
 * their own maturity flags; the ad cost per received order is SQL ad spend over SQL
 * received orders, converted at the engine's parallel rate B (so the Ads line
 * equals real DZD spend per delivered). Unknown rate / 0 received -> null.
 */
export function realScenarioInput(kpi: Kpi | null, parallelRate: number | null): RealScenario {
  const received = kpi?.counts.received ?? 0;
  const spend = kpi?.ad_spend_dzd;
  const rateOk = typeof parallelRate === "number" && Number.isFinite(parallelRate) && parallelRate > 0;
  const adCostUsd = received > 0 && typeof spend === "number" && rateOk ? spend / received / parallelRate : null;
  const adCostDzd = received > 0 && typeof spend === "number" ? spend / received : null;
  return {
    input: {
      confirm: kpi?.confirmation.value ?? null,
      delivery: kpi?.delivery.value ?? null,
      adCostUsd,
    },
    adCostDzd,
    hasData: received > 0,
    matured: !!kpi && kpi.confirmation.matured && kpi.delivery.matured,
  };
}

/** All-time KPI for one product (admin session: money keys present). */
export async function realKpiForProduct(supabase: SupabaseClient<Database>, productId: string): Promise<Kpi | null> {
  const { data, error } = await supabase.rpc("kpi_summary", { p_product: productId });
  if (error) throw new Error(`kpi_summary failed: ${error.message}`);
  return asKpi(data);
}
