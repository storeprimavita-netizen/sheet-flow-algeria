import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile, requireAdmin } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import { realKpiForProduct } from "@/lib/pricing-real";
import { sanitizeSparse } from "@/lib/pricing-form";
import { PricingCalculator } from "./pricing-calculator";

export default async function ProductPricingPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("/app/orders"); // admin-only money: re-checked here, not only in the layout
  const { id } = await params;
  const t = await getTranslations();
  const profile = (await getProfile())!;

  const supabase = await createClient();
  const [{ data: product }, { data: cost }, { data: pricing }, defaults, realKpi] = await Promise.all([
    supabase.from("products").select("sale_price, stock").eq("id", id).maybeSingle(),
    supabase.from("product_costs").select("sourcing_cost_dzd").eq("product_id", id).maybeSingle(),
    supabase.from("product_pricing").select("*").eq("product_id", id).maybeSingle(),
    getSetting(profile.workspaceId, "pricing_defaults"),
    realKpiForProduct(supabase, id),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-6">
      {/* section heading, not a page h1: the product header above owns the page title */}
      <div>
        <h2 className="text-base font-semibold">{t("pricingV2.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("pricingV2.product.subtitle")}</p>
      </div>
      <PricingCalculator
        productId={id}
        defaults={defaults}
        perPieceCost={cost?.sourcing_cost_dzd ?? null}
        stock={product.stock}
        salePrice={product.sale_price}
        realKpi={realKpi}
        saved={{
          overrides: sanitizeSparse(pricing?.overrides),
          adBest: pricing?.ad_best_usd ?? null,
          adMedium: pricing?.ad_medium_usd ?? null,
          adWorst: pricing?.ad_worst_usd ?? null,
          finalPrice: pricing?.final_price ?? null,
        }}
      />
    </div>
  );
}
