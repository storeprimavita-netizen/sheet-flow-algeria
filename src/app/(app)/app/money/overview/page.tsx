import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Banknote, Landmark, Megaphone, Wallet } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/rbac";
import { formatCurrency, formatPercent } from "@/lib/format";
import { asPnl, pnlMetrics } from "@/lib/pricing";
import { asKpi, kpiRoas } from "@/lib/kpi";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { StackedBar } from "@/components/charts/stacked-bar";
import { FinanceTabs } from "../finance-tabs";
import { FinanceFilterBar } from "../finance-filter-bar";
import { financeQs } from "@/lib/query-string";

const AGE_BUCKETS = [
  { key: "age0", max: 7 },
  { key: "age8", max: 14 },
  { key: "age15", max: 30 },
  { key: "age30", max: Infinity },
] as const;

/** Money for a non-DZD account balance: same grouping, its own currency code. */
const money = (v: number | null, currency: string) =>
  currency === "DZD" ? formatCurrency(v) : v == null ? "—" : `${Math.round(v).toLocaleString("en-US").replace(/,/g, " ")} ${currency}`;

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
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { data: products },
    { data: pnlRaw },
    { data: productPnls },
    { data: accountBalances },
    { data: categories },
    { data: unpaid },
    { data: onHand },
  ] = await Promise.all([
    supabase.from("products").select("id, name").order("name"),
    supabase.rpc("pnl_summary", { p_from: from, p_to: to, p_product: product }),
    supabase.rpc("pnl_by_product", { p_from: from, p_to: to }),
    supabase.from("account_balances").select("account_id, name, currency, balance, low_balance_threshold, is_active").eq("workspace_id", profile.workspaceId),
    supabase.rpc("dashboard_stats", { p_from: from, p_to: to, p_product: product ? [product] : undefined }),
    // Receivables are a balance, not a period figure: every delivered order the courier hasn't paid for.
    supabase.from("orders").select("id, sale_price, quantity, updated_at, cash:cash_collections(id)").eq("delivery_status", "delivered"),
    supabase.from("cash_collections").select("amount_dzd").eq("status", "collected"),
  ]);

  const pnl = asPnl(pnlRaw);
  const m = pnl ? pnlMetrics(pnl) : null;
  const productName = new Map((products ?? []).map((p) => [p.id, p.name]));
  const qs = (extra: Record<string, string | undefined>) => financeQs({ from, to }, extra);

  // 💳 aging — ponytail: ages by orders.updated_at (≈ the delivered change);
  // switch to the delivered row in order_status_history if edits skew it.
  const now = Date.now();
  const aging = AGE_BUCKETS.map((b) => ({ ...b, amount: 0, count: 0 }));
  for (const o of unpaid ?? []) {
    if (o.cash?.length) continue;
    const days = (now - new Date(o.updated_at).getTime()) / 86400000;
    const bucket = aging.find((b) => days <= b.max)!;
    bucket.amount += (o.sale_price ?? 0) * o.quantity;
    bucket.count += 1;
  }
  const owed = aging.reduce((s, b) => s + b.amount, 0);
  const cashOnHand = (onHand ?? []).reduce((s, c) => s + (c.amount_dzd ?? 0), 0);

  const balances = (accountBalances ?? []).filter((a) => a.is_active);
  const lowBalances = balances.filter((a) => a.balance != null && a.low_balance_threshold != null && a.balance <= a.low_balance_threshold);
  const categorySpending = ((categories as unknown as { category_spending?: { category: string; amount_dzd: number }[] } | null)?.category_spending ?? [])
    .slice()
    .sort((a, b) => b.amount_dzd - a.amount_dzd);
  const roasRows = (productPnls ?? [])
    .map((r) => ({ id: r.product_id, pnl: asPnl(r.pnl), roas: kpiRoas(asKpi(r.kpi)) }))
    .filter((r) => r.pnl && r.pnl.ad_spend > 0)
    .map((r) => ({ id: r.id, pnl: r.pnl!, roas: r.roas }))
    .sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));

  const costSlices = pnl
    ? [
        { key: "cogs", label: t("dashboard.pnl.cogs"), value: pnl.cogs, color: "var(--chart-2)", href: "/app/products" },
        { key: "returns", label: t("dashboard.pnl.returns"), value: pnl.return_fees, color: "var(--chart-4)", href: `/app/sell/orders${qs({ delivery_status: "returned", product_id: product })}` },
        { key: "ads", label: t("dashboard.pnl.ads"), value: pnl.ad_spend, color: "var(--chart-3)", href: `/app/money/ad-spend${qs({ product })}` },
        { key: "expenses", label: t("dashboard.pnl.expenses"), value: pnl.expenses, color: "var(--chart-5)", href: `/app/money/expenses${qs({ product })}` },
        { key: "fixed", label: t("dashboard.pnl.fixed"), value: pnl.fixed_fees, color: "var(--chart-1)", href: "/app/settings?section=fixed-fees" },
      ].map((c) => ({ ...c, display: formatCurrency(c.value) }))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.financeOverview")} subtitle={t("finance.subtitleOverview")} />
      <FinanceTabs active="overview" />
      <FinanceFilterBar products={(products ?? []).map((p) => ({ value: p.id, label: p.name }))} showCategory={false} showKind={false} />

      {lowBalances.length > 0 ? (
        <Link href="/app/money/accounts" className="block rounded-xl border border-danger/30 bg-danger-bg p-4 text-sm text-danger">
          {t("accounts.lowBalanceBanner", {
            accounts: lowBalances.map((a) => `${a.name} (${money(a.balance, a.currency ?? "DZD")})`).join(", "),
          })}
        </Link>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 🧾 P&L for the period — the one money model */}
        <section className="card-surface space-y-4 rounded-xl p-5 lg:col-span-7">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              {t("dashboard.pnl.title")}
            </h2>
            {m?.margin_pct != null ? <span className="text-xs text-muted-foreground">{t("dashboard.kpi2.margin", { pct: formatPercent(m.margin_pct) })}</span> : null}
          </div>
          {pnl ? (
            <div className="space-y-3">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <Link href={`/app/money/courier-cash?tab=income${qs({})}`} className="text-muted-foreground hover:underline">
                  {t("dashboard.pnl.revenue")}
                </Link>
                <span className="num">{formatCurrency(pnl.revenue)}</span>
              </div>
              <StackedBar
                title={t("dashboard.v2.money.chart.costsTitle")}
                head={[t("dashboard.v2.money.chart.costHead"), t("dashboard.v2.money.chart.amountHead"), t("dashboard.v2.money.chart.shareHead")]}
                empty={costSlices.length ? null : { title: t("dashboard.v2.money.noData") }}
                slices={costSlices}
              />
              <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2 text-sm font-semibold">
                <span>{t("dashboard.pnl.net")}</span>
                <span className={`num ${pnl.net_profit >= 0 ? "text-success" : "text-danger"}`}>
                  {pnl.net_profit > 0 ? "+" : ""}
                  {formatCurrency(pnl.net_profit)}
                </span>
              </div>
            </div>
          ) : (
            <Empty>{t("finance.noExpensesInRange")}</Empty>
          )}
          {pnl ? (
            <p className="text-xs text-muted-foreground">
              {t("settings.fixedFees")}:{" "}
              {t("finance.fixedProrated", { amount: formatCurrency(pnl.fixed_fees), monthly: formatCurrency(pnl.fixed_fees_monthly) })}
            </p>
          ) : null}
        </section>

        {/* 💳 receivables */}
        <section className="card-surface space-y-4 rounded-xl p-5 lg:col-span-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              {t("finance.receivables")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("finance.receivablesHint")}</p>
          </div>
          <Link href="/app/money/courier-cash" className="num block text-3xl font-semibold tracking-tight hover:underline">
            {formatCurrency(owed)}
          </Link>
          <ul className="space-y-2">
            {aging.map((b) => (
              <li key={b.key} className="space-y-1">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t(`finance.${b.key}`)} <span className="num text-faint">· {b.count}</span>
                  </span>
                  <span className={`num ${b.max > 14 && b.amount > 0 ? "text-danger" : ""}`}>{formatCurrency(b.amount)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-border">
                  <div
                    className={`h-1.5 rounded-full ${b.max > 14 ? "bg-danger" : b.max > 7 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${owed ? (b.amount / owed) * 100 : 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between border-t border-border pt-3 text-sm" title={t("finance.cashOnHandHint")}>
            <span className="text-muted-foreground">{t("finance.cashOnHand")}</span>
            <span className="num">{formatCurrency(cashOnHand)}</span>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 🏦 accounts */}
        <section className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Landmark className="h-4 w-4 text-muted-foreground" />
            {t("finance.accounts")}
          </h2>
          {!balances.length ? (
            <Empty>{t("accounts.empty")}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {balances.map((a) => {
                const low = a.balance != null && a.low_balance_threshold != null && a.balance <= a.low_balance_threshold;
                return (
                  <li key={a.account_id} className="flex items-baseline justify-between py-2 text-sm">
                    <Link href="/app/money/accounts" className="hover:underline">
                      {a.name}
                    </Link>
                    <span className={`num ${low ? "text-danger" : ""}`}>{money(a.balance, a.currency ?? "DZD")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 📣 ad spend split + ROAS */}
        <section className="card-surface space-y-4 rounded-xl p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            {t("finance.adSplit")}
          </h2>
          {pnl && pnl.ad_spend > 0 ? (
            <>
              <div className="flex h-2 overflow-hidden rounded-full bg-border">
                <div className="bg-info" style={{ width: `${(pnl.ad_spend_test / pnl.ad_spend) * 100}%` }} />
                <div className="bg-primary" style={{ width: `${(pnl.ad_spend_scaling / pnl.ad_spend) * 100}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Link href={`/app/money/ad-spend${qs({ product, kind: "test" })}`} className="flex items-center gap-2 hover:underline">
                  <span className="h-2 w-2 rounded-full bg-info" aria-hidden />
                  <span className="text-muted-foreground">{t("finance.adTest")}</span>
                  <span className="num ms-auto">{formatCurrency(pnl.ad_spend_test)}</span>
                </Link>
                <Link href={`/app/money/ad-spend${qs({ product, kind: "scaling" })}`} className="flex items-center gap-2 hover:underline">
                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                  <span className="text-muted-foreground">{t("finance.adScaling")}</span>
                  <span className="num ms-auto">{formatCurrency(pnl.ad_spend_scaling)}</span>
                </Link>
              </div>
              <div className="space-y-1 border-t border-border pt-3">
                <h3 className="text-xs font-medium text-muted-foreground">{t("finance.roasByProduct")}</h3>
                <ul className="space-y-1 text-sm">
                  {roasRows.map((r) => (
                    <li key={r.id} className="flex items-baseline justify-between gap-2">
                      <Link href={`/app/catalog/products/${r.id}/statistics`} className="truncate hover:underline">
                        {productName.get(r.id) ?? r.id.slice(0, 8)}
                      </Link>
                      <span className="num whitespace-nowrap text-xs text-muted-foreground">{formatCurrency(r.pnl.ad_spend)}</span>
                      <span className={`num w-14 text-end ${(r.roas ?? 0) >= 1 ? "text-success" : "text-danger"}`}>
                        {r.roas != null ? `${r.roas.toFixed(2)}×` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <Empty>{t("finance.noAdSpendInRange")}</Empty>
          )}
        </section>
      </div>

      <section className="card-surface space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("dashboard.categorySpending.title")}</h2>
        {!categorySpending.length ? (
          <Empty>{t("finance.noExpensesInRange")}</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            {categorySpending.map((c) => (
              <li key={c.category}>
                <Link href={`/app/money/expenses${qs({ category: c.category, product })}`} className="flex justify-between hover:underline">
                  <span className="text-muted-foreground">{t(`status.expense_category.${c.category}`)}</span>
                  <span className="num">{formatCurrency(c.amount_dzd)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
