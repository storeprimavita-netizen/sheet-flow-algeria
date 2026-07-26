import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import {
  DEFAULT_INPUTS,
  SCENARIO_SLUGS,
  normalizeInputs,
  seedForProduct,
  type PricingInputs,
  type ScenarioSlug,
} from "@/lib/pricing";
import { fxRateFor } from "@/lib/fx";
import { getSetting } from "@/lib/settings";

/**
 * Baseline for scenario rows that don't exist yet — same baseline for all
 * three slugs (the admin then tunes best/medium/worst from there, same as
 * the v1 planner). Seeds from Settings per SPEC §6: `euro_price` from the
 * current EUR rate, the fixed-fee inputs from `fixed_fees` (summed into
 * `salary_month` — see pricing-real.ts for why), `delivery_fee_da` from
 * `settings.return_fee`. Everything else keeps the sheet's BEST defaults.
 */
export async function defaultInputs(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  costTotal?: number | null,
  sellingPrice?: number | null,
): Promise<PricingInputs> {
  const [euroRate, { data: fees }, returnFee] = await Promise.all([
    fxRateFor(supabase, workspaceId, "EUR"),
    supabase.from("fixed_fees").select("amount_dzd").eq("workspace_id", workspaceId).eq("is_active", true),
    getSetting(workspaceId, "return_fee"),
  ]);

  const base = costTotal != null ? seedForProduct(costTotal, sellingPrice ?? null) : DEFAULT_INPUTS;
  const fixedFeesTotalDzd = (fees ?? []).reduce((sum, f) => sum + (f.amount_dzd ?? 0), 0);

  return { ...base, euro_price: euroRate, salary_month: fixedFeesTotalDzd, delivery_fee_da: returnFee.amount };
}

/** Load the 3 scenarios for a product (null = general planner); missing rows → `seed`. */
export async function loadScenarios(
  supabase: SupabaseClient<Database>,
  productId: string | null,
  seed: PricingInputs,
): Promise<Record<ScenarioSlug, PricingInputs>> {
  const base = {} as Record<ScenarioSlug, PricingInputs>;
  for (const slug of SCENARIO_SLUGS) base[slug] = { ...seed };

  let query = supabase.from("product_scenarios").select("slug,inputs");
  query = productId === null ? query.is("product_id", null) : query.eq("product_id", productId);
  const { data } = await query;

  for (const row of data ?? []) {
    if ((SCENARIO_SLUGS as string[]).includes(row.slug)) {
      base[row.slug as ScenarioSlug] = normalizeInputs(row.inputs);
    }
  }
  return base;
}
