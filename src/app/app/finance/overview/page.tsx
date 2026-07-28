import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { FinanceTabs } from "../finance-tabs";
import { FinanceFilterBar } from "../finance-filter-bar";
import { financeQs } from "@/lib/query-string";

type DashboardKpis = {
  kpis: {
    revenue_dzd: number | null;
    invested_dzd: number | null;
    net_profit_dzd: number | null;
  };
  category_spending: { category: string; amount_dzd: number }[];
};

export default async function FinanceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const from = sp.from || undefined;
  const to = sp.to || undefined;
  const product = sp.product || undefined;

  const t = await getTranslations();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  const [{ data: products }, { data: rpcData }, { data: fees }] = await Promise.all([
    supabase.from("products").select("id, name").order("name"),
    supabase.rpc("dashboard_stats", {
      p_from: from,
      p_to: to,
      p_product: product ? [product] : undefined,
    }),
    supabase.from("fixed_fees").select("amount_dzd").eq("workspace_id", profile.workspaceId).eq("is_active", true),
  ]);
  const stats = rpcData as unknown as DashboardKpis;
  const fixedFeesTotal = (fees ?? []).reduce((s, f) => s + (f.amount_dzd ?? 0), 0);

  let expenseQuery = supabase.from("expenses").select("product_id, amount_dzd").eq("workspace_id", profile.workspaceId);
  let adSpendQuery = supabase.from("ad_spend_daily").select("product_id, amount_dzd").eq("workspace_id", profile.workspaceId);
  if (from) {
    expenseQuery = expenseQuery.gte("spent_on", from);
    adSpendQuery = adSpendQuery.gte("spent_on", from);
  }
  if (to) {
    expenseQuery = expenseQuery.lte("spent_on", to);
    adSpendQuery = adSpendQuery.lte("spent_on", to);
  }
  if (product) {
    expenseQuery = expenseQuery.eq("product_id", product);
    adSpendQuery = adSpendQuery.eq("product_id", product);
  }
  const [{ data: expenseRows }, { data: adSpendRows }] = await Promise.all([expenseQuery, adSpendQuery]);

  const productName = new Map((products ?? []).map((p) => [p.id, p.name]));
  const spendByProduct = new Map<string, number>();
  for (const e of expenseRows ?? []) {
    if (!e.product_id) continue;
    spendByProduct.set(e.product_id, (spendByProduct.get(e.product_id) ?? 0) + (e.amount_dzd ?? 0));
  }
  for (const a of adSpendRows ?? []) {
    spendByProduct.set(a.product_id, (spendByProduct.get(a.product_id) ?? 0) + (a.amount_dzd ?? 0));
  }
  const productRows = [...spendByProduct.entries()].sort((a, b) => b[1] - a[1]);

  const qs = (extra: Record<string, string | undefined>) => financeQs({ from, to }, extra);

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.financeOverview")} subtitle={t("finance.subtitleOverview")} />
      <FinanceTabs active="overview" />
      <FinanceFilterBar products={(products ?? []).map((p) => ({ value: p.id, label: p.name }))} showCategory={false} showKind={false} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href={`/app/orders/all${qs({ delivery_status: "delivered", product_id: product })}`} className="card-surface block rounded-xl p-4 transition-colors hover:border-border-strong">
          <div className="text-xs text-muted-foreground">{t("dashboard.kpi.revenue")}</div>
          <div className="num mt-1 text-2xl font-semibold text-success">{formatCurrency(stats.kpis.revenue_dzd)}</div>
        </Link>
        <Link href={`/app/finance/expenses${qs({ product })}`} className="card-surface block rounded-xl p-4 transition-colors hover:border-border-strong">
          <div className="text-xs text-muted-foreground">{t("dashboard.kpi.invested")}</div>
          <div className="num mt-1 text-2xl font-semibold text-danger">{formatCurrency(stats.kpis.invested_dzd)}</div>
        </Link>
        <div className="card-surface rounded-xl p-4">
          <div className="text-xs text-muted-foreground">{t("dashboard.kpi.netProfit")}</div>
          <div
            className={`num mt-1 text-2xl font-semibold ${(stats.kpis.net_profit_dzd ?? 0) >= 0 ? "text-success" : "text-danger"}`}
          >
            {formatCurrency(stats.kpis.net_profit_dzd)}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.categorySpending.title")}</h2>
          {!stats.category_spending.length ? (
            <Empty>{t("finance.noExpensesInRange")}</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.category_spending
                .slice()
                .sort((a, b) => b.amount_dzd - a.amount_dzd)
                .map((c) => (
                  <li key={c.category}>
                    <Link
                      href={`/app/finance/expenses${qs({ category: c.category, product })}`}
                      className="flex justify-between hover:underline"
                    >
                      <span className="text-muted-foreground">{t(`status.expense_category.${c.category}`)}</span>
                      <span className="num">{formatCurrency(c.amount_dzd)}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("finance.spendByProduct")}</h2>
          {!productRows.length ? (
            <Empty>{t("finance.noExpensesInRange")}</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {productRows.map(([productId, amount]) => (
                <li key={productId} className="flex justify-between">
                  <Link href={`/app/products/${productId}`} className="text-muted-foreground hover:underline">
                    {productName.get(productId) ?? productId.slice(0, 8)}
                  </Link>
                  <Link href={`/app/finance/expenses${qs({ product: productId })}`} className="num hover:underline">
                    {formatCurrency(amount)}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Link href="/app/settings" className="card-surface block rounded-xl p-4 transition-colors hover:border-border-strong">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">{t("settings.fixedFees")}</span>
          <span className="num text-sm">{formatCurrency(fixedFeesTotal)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t("finance.fixedFeesNote")}</p>
      </Link>
    </div>
  );
}
