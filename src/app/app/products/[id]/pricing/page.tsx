import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { realInputsForProduct } from "@/lib/pricing-real";
import { defaultInputs, loadScenarios } from "../../pricing-data";
import { ScenarioEngine } from "../../scenario-engine";

export default async function ProductPricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const profile = (await getProfile())!;

  const supabase = await createClient();
  const [{ data: product }, { data: cost }] = await Promise.all([
    supabase.from("products").select("sale_price").eq("id", id).maybeSingle(),
    supabase.from("product_costs").select("sourcing_cost_dzd").eq("product_id", id).maybeSingle(),
  ]);
  if (!product) notFound();

  const seed = await defaultInputs(supabase, profile.workspaceId, cost?.sourcing_cost_dzd, product.sale_price);
  const [initial, real] = await Promise.all([
    loadScenarios(supabase, id, seed),
    realInputsForProduct(supabase, profile.workspaceId, id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("pricing.title")} subtitle={t("pricing.subtitleProduct")} />
      <ScenarioEngine workspaceId={profile.workspaceId} productId={id} initial={initial} real={real} />
    </div>
  );
}
