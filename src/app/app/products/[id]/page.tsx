import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { seedForProduct } from "@/lib/pricing";
import { loadScenarios } from "@/lib/pricing-server";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/delete-button";
import { ProductForm } from "../product-form";
import { ScenarioEngine } from "../../pricing/scenario-engine";

const COST_KEYS = [
  "cost_shooting",
  "cost_packaging",
  "cost_sampling",
  "cost_confirmation",
  "cost_delivery",
  "cost_test_ads",
  "cost_scaling_ads",
] as const;

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/app/products");
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const costTotal = COST_KEYS.reduce((sum, k) => sum + Number(product[k] ?? 0), 0);
  const initial = await loadScenarios(product.id, seedForProduct(costTotal, product.selling_price));

  return (
    <div className="space-y-6">
      <PageHeader title={t("products.edit")} subtitle={product.name}>
        <DeleteButton table="products" id={product.id} redirectTo="/app/products" />
      </PageHeader>
      <ProductForm product={product} />

      <section className="space-y-3 pt-2">
        <div>
          <h2 className="text-sm font-semibold">{t("pricing.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("pricing.subtitleProduct")}</p>
        </div>
        <ScenarioEngine productId={product.id} initial={initial} />
      </section>
    </div>
  );
}
