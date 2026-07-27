import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { AdSpendForm } from "@/components/finance/ad-spend-form";
import { AdSpendTable } from "@/components/finance/ad-spend-table";
import { FinanceTabs } from "../finance-tabs";
import { FinanceFilterBar } from "../finance-filter-bar";

export default async function FinanceAdSpendPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { from, to, product, kind } = sp;

  const t = await getTranslations();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  let query = supabase
    .from("ad_spend_daily")
    .select("*")
    .eq("workspace_id", profile.workspaceId)
    .order("spent_on", { ascending: false });
  if (from) query = query.gte("spent_on", from);
  if (to) query = query.lte("spent_on", to);
  if (product) query = query.eq("product_id", product);
  if (kind) query = query.eq("kind", kind as never);

  const [{ data: rows }, { data: products }, usdRate, eurRate] = await Promise.all([
    query,
    supabase.from("products").select("id, name, images, status").order("name"),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
  ]);
  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };
  const productOpts = (products ?? []).map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, status: p.status }));
  const productName = new Map(productOpts.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.adSpend")} subtitle={t("finance.subtitleAdSpend")} />
      <FinanceTabs active="ad-spend" />
      <FinanceFilterBar products={productOpts.map((p) => ({ value: p.id, label: p.name }))} showKind />
      <AdSpendForm products={productOpts} rates={rates} />
      <AdSpendTable rows={rows ?? []} products={productOpts} rates={rates} productName={productName} />
    </div>
  );
}
