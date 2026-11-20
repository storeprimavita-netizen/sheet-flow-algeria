import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/rbac";
import { asKpi, type Kpi } from "@/lib/kpi";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { AddAdSpendModal } from "@/components/dashboard/add-ad-spend-modal";
import { NeedsActionBand, type NeedsActionCounts } from "@/components/dashboard/needs-action-band";
import { MoneyBand, WaterfallBand } from "@/components/dashboard/money-band";
import { OrderJourney } from "@/components/dashboard/order-journey";
import { StockStrip, type StockRow } from "@/components/dashboard/stock-strip";
import { ProductScorecard, type ScorecardRow } from "@/components/dashboard/product-scorecard";
import { DashboardFilterBar, type Opt } from "./dashboard-filter-bar";
import { financeQs, ordersQs, type DashboardFilters } from "@/lib/query-string";
import { AT_COURIER, RETRY_CONFIRMATION, STUCK_DAYS } from "@/lib/statuses";

// Dashboard v2 (P1-2): six bands, admin-only (AdminGuardLayout sends agents to /app/orders).
// Every figure comes from SQL: dashboard_stats().kpi = kpi_lines (P1-1), per_product, product_stock_v.
// No formula lives here (guarded by dashboard-kpi-source.test.ts).

type PerProduct = { product_id: string; name: string; delivery_rate: number | null };

function isoDaysAgo(from: string, n: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : "");

  const t = await getTranslations();
  const profile = await requireProfile();
  const supabase = await createClient();

  // Only period + product filter the dashboard; other params are ignored.
  const filters: DashboardFilters = { from: get("from") || undefined, to: get("to") || undefined, product: get("product") || undefined };

  const products0 = await supabase.from("products").select("id, name").order("name");
  // An unknown product id (deleted, mistyped) is dropped rather than filtering to nothing.
  if (filters.product && !(products0.data ?? []).some((p) => p.id === filters.product)) filters.product = undefined;
  const rpcParams = { p_from: filters.from, p_to: filters.to, p_product: filters.product ? [filters.product] : undefined };

  const stuckBefore = new Date(Date.now() - STUCK_DAYS * 86400000).toISOString();
  const count = { count: "exact" as const, head: true };

  // delta-vs-previous-period only makes sense for a bounded range.
  const prevParams =
    filters.from && filters.to
      ? (() => {
          const lengthDays = Math.round((new Date(filters.to).getTime() - new Date(filters.from).getTime()) / 86400000) + 1;
          const prevTo = isoDaysAgo(filters.from, 1);
          return { ...rpcParams, p_from: isoDaysAgo(prevTo, lengthDays - 1), p_to: prevTo };
        })()
      : null;


  const [products, stats, prevStats, eurRate, toConfirm, toShip, toRetry, stuck, stock, productPnls] = await Promise.all([
    Promise.resolve(products0),
    supabase.rpc("dashboard_stats", rpcParams),
    prevParams ? supabase.rpc("dashboard_stats", prevParams) : Promise.resolve(null),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
    supabase.from("orders").select("id", count).eq("confirmation_status", "wait_for_confirmation"),
    supabase.from("orders").select("id", count).eq("confirmation_status", "confirmed").eq("delivery_status", "wait_for_deposit"),
    supabase.from("orders").select("id", count).in("confirmation_status", [...RETRY_CONFIRMATION]),
    supabase.from("orders").select("id", count).in("delivery_status", [...AT_COURIER]).lt("updated_at", stuckBefore),
    (() => {
      const q = supabase.from("product_stock_v").select("product_id, in_stock, reserved, on_road, delivered, low");
      return filters.product ? q.eq("product_id", filters.product) : q;
    })(),
    supabase.rpc("pnl_by_product", { p_from: filters.from, p_to: filters.to }),
  ]);

  const statsJson = stats.error ? null : (stats.data as unknown as { kpi: Kpi; per_product: PerProduct[] } | null);
  const kpi = asKpi(statsJson?.kpi);
  const prevKpi = asKpi((prevStats?.data as unknown as { kpi: Kpi } | null | undefined)?.kpi);

  const needs: NeedsActionCounts | null =
    toConfirm.error || toShip.error || toRetry.error || stuck.error
      ? null
      : { toConfirm: toConfirm.count ?? 0, toShip: toShip.count ?? 0, toRetry: toRetry.count ?? 0, stuck: stuck.count ?? 0 };

  const nameById = new Map((products.data ?? []).map((p) => [p.id, p.name]));
  const stockRows: StockRow[] | null =
    stock.error || products.error
      ? null
      : (stock.data ?? [])
          .map((s) => ({ productId: s.product_id, name: nameById.get(s.product_id) ?? "—", inStock: s.in_stock, reserved: s.reserved ?? 0, onRoad: s.on_road ?? 0, delivered: s.delivered ?? 0, low: s.low ?? false }))
          .sort((a, b) => Number(b.low) - Number(a.low) || a.inStock - b.inStock);

  const inStockById = new Map((stock.data ?? []).map((s) => [s.product_id, s.in_stock]));
  const kpiByProduct = new Map((productPnls.data ?? []).map((r) => [r.product_id, asKpi(r.kpi)]));
  const scorecard: ScorecardRow[] | null =
    !statsJson || productPnls.error
      ? null
      : (statsJson.per_product ?? []).map((p) => {
          const pk = kpiByProduct.get(p.product_id) ?? null;
          return { productId: p.product_id, name: p.name, deliveryRate: p.delivery_rate, kpi: pk, netProfit: pk?.net_profit ?? null, inStock: inStockById.get(p.product_id) ?? null };
        });

  const productOpts: Opt[] = (products.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const finance = (path: string) =>
    `/app/money${path ? `/${path}` : ""}${financeQs({ from: filters.from, to: filters.to }, { product: filters.product })}`;
  const moneyHrefs = {
    finance: finance("overview"),
    revenue: ordersQs(filters, { delivery_status: "delivered" }),
    returns: ordersQs(filters, { delivery_status: "returned" }),
    ads: finance("ad-spend"),
    expenses: finance("expenses"),
    cogs: "/app/catalog/products",
    fixed: "/app/settings?section=fixed-fees",
  };
  const rates = { USD: kpi?.usd_rate ?? 1, EUR: eurRate.data ?? 1 };

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
        <AddAdSpendModal products={productOpts.map((p) => ({ id: p.value, name: p.label }))} rates={rates} />
        <ButtonLink href="/app/sell/orders/new" variant="outline">
          {t("orders.new")}
        </ButtonLink>
      </PageHeader>

      {/* Desktop order 1..6; mobile order 1,2,3,5,4,6 (stock before the waterfall). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-12">
          <DashboardFilterBar products={productOpts} />
        </div>
        <div className="lg:col-span-12">
          <NeedsActionBand counts={needs} />
        </div>
        <div className="lg:col-span-12">
          <MoneyBand kpi={kpi} prev={prevKpi} hrefs={moneyHrefs} />
        </div>
        <div className="lg:col-span-5">
          <OrderJourney
            kpi={kpi}
           
            hrefs={{
              received: ordersQs(filters),
              confirmed: ordersQs(filters, { confirmation_status: "confirmed" }),
              onRoad: "/app/sell/shipping",
              delivered: ordersQs(filters, { delivery_status: "delivered" }),
            }}
          />
        </div>
        <div className="max-lg:order-5 lg:col-span-7">
          <WaterfallBand kpi={kpi} hrefs={moneyHrefs} />
        </div>
        <div className="max-lg:order-4 lg:col-span-12">
          <StockStrip rows={stockRows} />
        </div>
        <div className="max-lg:order-6 lg:col-span-12">
          <ProductScorecard rows={scorecard} hasProducts={productOpts.length > 0} />
        </div>
      </div>
    </div>
  );
}
