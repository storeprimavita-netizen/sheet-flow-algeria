import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_INPUTS,
  normalizeInputs,
  type PricingInputs,
  type ScenarioSlug,
} from "@/lib/pricing";

const SLUGS: ScenarioSlug[] = ["best", "medium", "worst"];

/** Load the 3 scenarios for a product (null = general planner). Missing rows → defaults/seed. */
export async function loadScenarios(
  productId: string | null,
  seed?: PricingInputs,
): Promise<Record<ScenarioSlug, PricingInputs>> {
  const base = {} as Record<ScenarioSlug, PricingInputs>;
  const s = seed ?? DEFAULT_INPUTS;
  for (const slug of SLUGS) base[slug] = { ...s };

  const supabase = await createClient();
  const query = supabase.from("pricing_scenarios").select("slug,inputs");
  const { data } =
    productId === null
      ? await query.is("product_id", null)
      : await query.eq("product_id", productId);

  for (const row of data ?? []) {
    if ((SLUGS as string[]).includes(row.slug)) {
      base[row.slug as ScenarioSlug] = normalizeInputs(row.inputs);
    }
  }
  return base;
}
