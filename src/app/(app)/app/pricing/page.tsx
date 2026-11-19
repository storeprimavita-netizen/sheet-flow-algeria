import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { sanitizeSparse } from "@/lib/pricing-form";
import { portfolioRow } from "@/lib/pricing-portfolio";
import { getProfile, requireAdmin } from "@/lib/rbac";
import { getSetting } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { PortfolioView } from "./portfolio-view";

export default async function PricingPortfolioPage() {
  await requireAdmin("/app/orders"); // admin-only money: re-checked here, not only in the layout
  const t = await getTranslations("pricingPortfolio");
  const profile = (await getProfile())!;

  const supabase = await createClient();
  const [products, costs, pricing, defaults] = await Promise.all([
    supabase.from("products").select("id, name, sale_price, stock").order("name"),
    supabase.from("product_costs").select("product_id, sourcing_cost_dzd"),
    supabase.from("product_pricing").select("*"),
    getSetting(profile.workspaceId, "pricing_defaults"),
  ]);
  if (products.error || costs.error || pricing.error) throw new Error("pricing portfolio load failed");

  const costById = new Map(costs.data.map((c) => [c.product_id, c.sourcing_cost_dzd]));
  const pricingById = new Map(pricing.data.map((p) => [p.product_id, p]));
  const rows = products.data.map((p) => {
    const saved = pricingById.get(p.id);
    return portfolioRow(defaults, {
      id: p.id,
      name: p.name,
      salePrice: p.sale_price,
      stock: p.stock,
      perPieceCost: costById.get(p.id) ?? null,
      pricing: saved
        ? {
            overrides: sanitizeSparse(saved.overrides),
            adBest: saved.ad_best_usd,
            adMedium: saved.ad_medium_usd,
            adWorst: saved.ad_worst_usd,
            finalPrice: saved.final_price,
          }
        : null,
    });
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <PortfolioView rows={rows} />
    </div>
  );
}
