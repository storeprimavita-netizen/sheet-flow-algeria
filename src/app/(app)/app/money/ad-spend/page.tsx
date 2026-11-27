import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/rbac";
import { pageHref, parsePage, readPage } from "@/lib/list-pagination";
import { PageHeader } from "@/components/page-header";
import { AdSpendForm } from "@/components/finance/ad-spend-form";
import { AdSpendTable } from "@/components/finance/ad-spend-table";
import { FinanceTabs } from "../finance-tabs";
import { FinanceFilterBar } from "../finance-filter-bar";
import { parseFinanceFilters } from "../finance-filters";

export default async function FinanceAdSpendPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { from, to, product, kind } = parseFinanceFilters(sp);
  const page = parsePage(sp.page);

  const t = await getTranslations();
  const profile = await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("ad_spend_daily")
    .select("*", { count: "exact" })
    .eq("workspace_id", profile.workspaceId)
    .order("spent_on", { ascending: false })
    .order("id");
  if (from) query = query.gte("spent_on", from);
  if (to) query = query.lte("spent_on", to);
  if (product) query = query.eq("product_id", product);
  if (kind) query = query.eq("kind", kind);

  const [list, productsRead, usdRate, eurRate, accountsRead] = await Promise.all([
    // `.range` replaces the previous offsets, so readPage may reuse the builder.
    readPage(page, (start, end) => query.range(start, end)),
    supabase.from("products").select("id, name, images, status").order("name"),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
    supabase.from("accounts").select("id, name, is_active").eq("workspace_id", profile.workspaceId).eq("is_active", true).order("name"),
  ]);
  if (list.goTo) redirect(pageHref("/app/money/ad-spend", sp, "page", list.goTo));
  const failed = [productsRead, usdRate, eurRate, accountsRead].find((r) => r.error)?.error;
  if (failed) throw new Error(failed.message);
  const [products, accounts] = [productsRead.data, accountsRead.data];
  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };
  const productOpts = (products ?? []).map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, status: p.status }));
  const productName = new Map(productOpts.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.adSpend")} subtitle={t("finance.subtitleAdSpend")}
        related={[{ href: "/app/money/expenses", label: t("nav.expenses") }, { href: "/app/money/accounts", label: t("nav.accounts") }]}
      />
      <FinanceTabs active="ad-spend" />
      <FinanceFilterBar products={productOpts.map((p) => ({ value: p.id, label: p.name }))} showKind />
      <AdSpendForm products={productOpts} rates={rates} accounts={accounts ?? []} />
      <AdSpendTable rows={list.rows} total={list.total} products={productOpts} rates={rates} productName={productName} />
    </div>
  );
}
