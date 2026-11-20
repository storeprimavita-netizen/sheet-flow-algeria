"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { productPricingInputSchema } from "@/lib/pricing-form";

export type SaveProductPricingResult = { ok: true } | { ok: false; error: "invalid" | "notFound" | "failed" };

/**
 * Save a product's pricing overrides, ad costs and final price. Session client
 * (RLS: admin + own workspace); the composite FK also refuses a product of
 * another workspace. Nothing derived (prices, totals) comes from the client.
 */
export async function saveProductPricing(input: unknown): Promise<SaveProductPricingResult> {
  const { workspaceId } = await requireAdminProfile();
  const parsed = productPricingInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", v.productId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!product) return { ok: false, error: "notFound" };

  const { error } = await supabase.from("product_pricing").upsert(
    {
      product_id: v.productId,
      workspace_id: workspaceId,
      overrides: v.overrides,
      ad_best_usd: v.adBestUsd,
      ad_medium_usd: v.adMediumUsd,
      ad_worst_usd: v.adWorstUsd,
      final_price: v.finalPrice,
    },
    { onConflict: "product_id" },
  );
  if (error) return { ok: false, error: "failed" };
  revalidatePath(`/app/catalog/products/${v.productId}/pricing`);
  return { ok: true };
}
