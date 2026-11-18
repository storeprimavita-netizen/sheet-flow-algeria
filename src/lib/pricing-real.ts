import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import type { PricingInputs } from "@/lib/pricing";
import { fxRateFor } from "@/lib/fx";
import { asKpi, kpiPct } from "@/lib/kpi";
import { getSetting } from "@/lib/settings";

const safeDiv = (a: number, b: number): number => (b ? a / b : 0);

export type RealPricing = { inputs: PricingInputs; hasData: boolean };

/**
 * Real-world actuals fed into computeScenario() for the read-only "Real"
 * column (SPEC §6). `hasData` is false until the product has at least one
 * order — computeScenario()'s guarded divisions turn missing actuals into 0,
 * not NaN, but the UI should show "—" rather than a misleading zero profit.
 *
 * v2 has no per-fixed-fee category (the v1 sheet split flexy/salary/rent);
 * the whole active fixed_fees monthly total goes into `salary_month` —
 * computeScenario only ever sums the three fields, so the bucket doesn't
 * change the result. `delivery_fee_da` (the sheet's per-RETURN fee) comes from
 * settings.return_fee. Lead cost and daily spend share one window (last 30
 * days) so they describe the same traffic. `delivery_price`/
 * `confirmation_agent`/`packaging_fees` have no actuals source, so they stay 0.
 */
export async function realInputsForProduct(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  productId: string,
): Promise<RealPricing> {
  // Africa/Algiers day, same as the SQL range predicate (D46)
  const since = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA", { timeZone: "Africa/Algiers" });

  const [{ data: stats }, { data: kpiRaw }, { data: kpi30Raw }, { data: product }, { data: last30 }, { data: fees }, euroRate, returnFee] = await Promise.all([
    supabase.from("product_stats").select("*").eq("id", productId).maybeSingle(),
    supabase.rpc("kpi_summary", { p_product: productId }), // all-time rates: the one KPI source
    supabase.rpc("kpi_summary", { p_from: since, p_product: productId }), // 30-day lead count, counted in SQL
    supabase.from("products").select("sale_price").eq("id", productId).maybeSingle(),
    supabase.from("ad_spend_daily").select("amount_dzd").eq("product_id", productId).gte("spent_on", since),
    supabase.from("fixed_fees").select("amount_dzd").eq("workspace_id", workspaceId).eq("is_active", true),
    fxRateFor(supabase, workspaceId, "EUR"),
    getSetting(workspaceId, "return_fee"),
  ]);

  const kpi = asKpi(kpiRaw);
  const orders30 = asKpi(kpi30Raw)?.counts.received ?? 0; // eligible leads, no row cap
  const ordersReceived = kpi?.counts.received ?? 0;
  const last30TotalDzd = (last30 ?? []).reduce((sum, r) => sum + (r.amount_dzd ?? 0), 0);
  const fixedFeesTotalDzd = (fees ?? []).reduce((sum, f) => sum + (f.amount_dzd ?? 0), 0);

  const inputs: PricingInputs = {
    product_price: stats?.sourcing_cost_dzd ?? 0,
    euro_price: euroRate,
    lead_cost_eur: safeDiv(safeDiv(last30TotalDzd, orders30), euroRate),
    // pricing.ts: confirmation_pct = % of leads that confirm; delivery_pct = % of confirmed that deliver
    confirmation_pct: kpiPct({ value: kpi?.confirmation.of_received ?? null }) ?? 0,
    delivery_pct: kpiPct(kpi?.delivered_of_confirmed) ?? 0,
    delivery_price: 0,
    confirmation_agent: 0,
    packaging_fees: 0,
    sale_price: product?.sale_price ?? 0,
    spend_eur_day: safeDiv(safeDiv(last30TotalDzd, 30), euroRate),
    delivery_fee_da: returnFee.amount,
    flexy_month: 0,
    location_day: 0,
    salary_month: fixedFeesTotalDzd,
  };

  return { inputs, hasData: ordersReceived > 0 };
}
