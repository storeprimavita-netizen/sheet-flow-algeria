import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Boxes,
  Coins,
  Landmark,
  ListTodo,
  MapPinOff,
  Megaphone,
  PackageCheck,
  PackageX,
  PhoneCall,
  Receipt,
  ShoppingCart,
  Target,
  TimerOff,
  TrendingDown,
  Truck,
  Undo2,
  Wallet,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import type { Enums } from "@/lib/supabase/database.types";
import { formatCurrency, formatDate, formatDuration } from "@/lib/format";
import { asPnl, pnlMetrics, type PnlLines } from "@/lib/pricing";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { ColorDot } from "@/components/ui/chip";
import { ACTIONABLE_CONFIRMATION, TASK_PRIORITY_TOKEN } from "@/lib/statuses";
import { ButtonLink } from "@/components/button-link";
import { KpiTile } from "@/components/stats/kpi-tile";
import { Funnel } from "@/components/stats/funnel";
import { RateCell } from "@/components/stats/rate-bar";
import { TimeChart } from "@/components/dashboard/time-chart";
import { PnlWaterfall } from "@/components/dashboard/pnl-waterfall";
import { CategoryBars } from "@/components/dashboard/category-bars";
import { StatusBreakdownBars } from "@/components/dashboard/status-breakdown-bars";
import { AddAdSpendModal } from "@/components/dashboard/add-ad-spend-modal";
import { WilayaSection, type WilayaRow } from "./wilaya-section";
import { DashboardFilterBar, type Opt } from "./dashboard-filter-bar";
import { financeQs, ordersQs, type DashboardFilters } from "@/lib/query-string";
import { DashboardExportButtons, type OrderExportRow } from "./export-button";

// Dashboard is admin-only (AdminGuardLayout redirects agents to /app/orders —
// Phase 1's "agents see only Orders, nothing else" per SPEC §2). The RPC
// still gates money fields behind is_admin() as a second layer (RLS is the
// wall, UI is cosmetic), but there is no agent-facing view to build here.

type DashboardStats = {
  is_admin: boolean;
  stage_counts: Record<"received" | "confirmed" | "shipped" | "delivered" | "cancelled" | "returned", number>;
  funnel: { stage: string; count: number }[];
  kpis: {
    revenue_dzd: number | null;
    invested_dzd: number | null;
    net_profit_dzd: number | null;
    confirmation_rate: number | null;
    delivery_rate: number | null;
  };
  category_spending: { category: string; amount_dzd: number }[];
  per_wilaya: {
    wilaya_code: number;
    wilaya_name: string | null;
    total_orders: number;
    confirmed_orders: number;
    delivered_orders: number;
    returned_orders: number;
    delivery_rate: number | null;
    stop_shipping_manual: boolean;
    stop_shipping_auto: boolean;
  }[];
  per_agent: {
    user_id: string;
    display_name: string | null;
    stage: string;
    orders_handled: number;
    confirmed: number;
    delivered: number;
    lost: number;
    avg_decision_seconds: number | null;
  }[];
  per_product: {
    product_id: string;
    name: string;
    orders_received: number;
    orders_confirmed: number;
    orders_delivered: number;
    orders_returned: number;
    confirmation_rate: number | null;
    delivery_rate: number | null;
    revenue_dzd: number;
  }[];
  daily: { day: string; orders_received: number; orders_confirmed: number; orders_delivered: number; revenue_dzd: number; invested_dzd: number }[];
  stop_shipping_min_orders: number;
  confirmation_breakdown: { status: string; count: number }[];
  delivery_breakdown: { status: string; count: number }[];
  pnl: PnlLines | null;
};

const STUCK_DAYS = 5;
const AT_COURIER = ["bureau_deposited", "in_transit", "out_for_delivery", "stop_desk_waiting"] as const;

/** Signed % change vs the previous period, or null when it can't be computed. */
function pctDelta(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

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
  const profile = (await getProfile())!;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: products }, { data: wilayas }, { data: team }, { data: nextMeeting }, { data: myTasks }] = await Promise.all([
    supabase.from("products").select("id, name").order("name"),
    supabase.from("wilayas").select("code, name").order("code"),
    supabase.from("profiles").select("user_id, display_name, role").eq("is_active", true),
    supabase
      .from("meetings")
      .select("id, title, scheduled_at")
      .eq("status", "planned")
      .gte("scheduled_at", new Date().toISOString())
      .order("scheduled_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tasks")
      .select("id, title, due_date, priority")
      .eq("owner", user!.id)
      .neq("status", "done")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);
  const agents = (team ?? []).filter((a) => a.role !== "admin");

  const filters: DashboardFilters = {
    from: get("from") || undefined,
    to: get("to") || undefined,
    product: get("product") || undefined,
    wilaya: get("wilaya") || undefined,
    source: get("source") || undefined,
    agent: get("agent") || undefined,
    confirmation_status: get("confirmation_status") || undefined,
    delivery_status: get("delivery_status") || undefined,
  };

  const rpcParams = {
    p_from: filters.from,
    p_to: filters.to,
    p_product: filters.product ? [filters.product] : undefined,
    p_wilaya: filters.wilaya ? [Number(filters.wilaya)] : undefined,
    p_source: filters.source ? [filters.source as Enums<"order_source">] : undefined,
    p_agent: filters.agent ? [filters.agent] : undefined,
    p_confirmation_status: filters.confirmation_status ? [filters.confirmation_status as Enums<"confirmation_status">] : undefined,
    p_delivery_status: filters.delivery_status ? [filters.delivery_status as Enums<"delivery_status">] : undefined,
  };

  const [{ data: rpcData }, usdRate, eurRate] = await Promise.all([
    supabase.rpc("dashboard_stats", rpcParams),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
  ]);
  const stats = rpcData as unknown as DashboardStats;
  // Defends against an RPC that hasn't been migrated yet (daily/
  // stop_shipping_min_orders are new fields) — degrade to empty sparklines
  // instead of a hard crash if the DB is behind the app.
  stats.daily ??= [];
  stats.stop_shipping_min_orders ??= 10;
  stats.confirmation_breakdown ??= [];
  stats.delivery_breakdown ??= [];
  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };

  // ⚡ Today strip + 🚨 alerts — fixed (ignore the filter bar): what needs action now.
  const isoDay = (d: Date) => d.toLocaleDateString("en-CA");
  const todayIso = isoDay(new Date());
  const yesterdayIso = isoDay(new Date(Date.now() - 86400000));
  const stuckBefore = new Date(Date.now() - STUCK_DAYS * 86400000).toISOString();
  const count = { count: "exact" as const, head: true };
  const [ordersToday, ordersYesterday, toConfirm, toShip, stuck, { data: allTimeRaw }, { data: stockRows }, { data: balances }, { data: productPnls }] =
    await Promise.all([
      supabase.from("orders").select("id", count).gte("placed_at", todayIso),
      supabase.from("orders").select("id", count).gte("placed_at", yesterdayIso).lt("placed_at", todayIso),
      supabase.from("orders").select("id", count).in("confirmation_status", ACTIONABLE_CONFIRMATION),
      supabase.from("orders").select("id", count).eq("confirmation_status", "confirmed").eq("delivery_status", "wait_for_deposit"),
      supabase.from("orders").select("id", count).in("delivery_status", [...AT_COURIER]).lt("updated_at", stuckBefore),
      supabase.rpc("pnl_summary", {}),
      supabase.from("products").select("id, name, stock, low_stock_threshold").neq("status", "cancelled"),
      supabase.from("account_balances").select("account_id, name, balance, low_balance_threshold").eq("is_active", true),
      supabase.rpc("pnl_by_product", { p_from: filters.from, p_to: filters.to }),
    ]);
  const allTime = asPnl(allTimeRaw);
  const lowStock = (stockRows ?? []).filter((p) => p.stock <= p.low_stock_threshold).sort((a, b) => a.stock - b.stock);
  const lowBalances = (balances ?? []).filter((b) => (b.balance ?? 0) < (b.low_balance_threshold ?? 0));
  const pnlByProduct = new Map((productPnls ?? []).map((r) => [r.product_id, asPnl(r.pnl)]));

  // delta-vs-previous-period only makes sense for a bounded range — an
  // unfiltered "all time" view has no natural "previous" to compare against.
  let prevStats: DashboardStats | null = null;
  if (filters.from && filters.to) {
    const lengthDays = Math.round((new Date(filters.to).getTime() - new Date(filters.from).getTime()) / 86400000) + 1;
    const prevTo = isoDaysAgo(filters.from, 1);
    const prevFrom = isoDaysAgo(prevTo, lengthDays - 1);
    const { data: prevData } = await supabase.rpc("dashboard_stats", { ...rpcParams, p_from: prevFrom, p_to: prevTo });
    prevStats = prevData as unknown as DashboardStats;
  }

  // CSV export needs raw rows, not aggregates — same filter set as the RPC,
  // applied via PostgREST instead of SQL.
  // ponytail: capped at 5000 rows; add pagination if a workspace's filtered
  // export ever needs more than that.
  let orderQuery = supabase
    .from("orders")
    .select(
      "order_number, placed_at, quantity, sale_price, confirmation_status, delivery_status, product:products(name), customer:customers(name), wilaya:wilayas(name)",
    )
    .limit(5000);
  if (filters.from) orderQuery = orderQuery.gte("placed_at", filters.from);
  if (filters.to) orderQuery = orderQuery.lte("placed_at", `${filters.to}T23:59:59`);
  if (filters.product) orderQuery = orderQuery.eq("product_id", filters.product);
  if (filters.wilaya) orderQuery = orderQuery.eq("wilaya_code", Number(filters.wilaya));
  if (filters.source) orderQuery = orderQuery.eq("source", filters.source as Enums<"order_source">);
  if (filters.confirmation_status) orderQuery = orderQuery.eq("confirmation_status", filters.confirmation_status as Enums<"confirmation_status">);
  if (filters.delivery_status) orderQuery = orderQuery.eq("delivery_status", filters.delivery_status as Enums<"delivery_status">);
  // .or() takes a raw PostgREST filter string — validate the shape first (same guard orders/all uses).
  const agentId = filters.agent && /^[0-9a-f-]{36}$/i.test(filters.agent) ? filters.agent : "";
  if (agentId) orderQuery = orderQuery.or(`assigned_confirmation_agent.eq.${agentId},assigned_delivery_agent.eq.${agentId}`);
  const { data: exportOrders } = await orderQuery;

  const exportRows: OrderExportRow[] = (exportOrders ?? []).map((o) => ({
    order_number: o.order_number,
    placed_at: o.placed_at,
    customer_name: o.customer?.name ?? null,
    product_name: o.product?.name ?? null,
    wilaya_name: o.wilaya?.name ?? null,
    quantity: o.quantity,
    total_dzd: (o.sale_price ?? 0) * o.quantity,
    confirmation_status: o.confirmation_status,
    delivery_status: o.delivery_status,
  }));

  const summaryRows = [
    { label: t("dashboard.kpi.revenue"), value: stats.kpis.revenue_dzd ?? 0 },
    { label: t("dashboard.kpi.invested"), value: stats.kpis.invested_dzd ?? 0 },
    { label: t("dashboard.kpi.netProfit"), value: stats.kpis.net_profit_dzd ?? 0 },
    { label: t("dashboard.kpi.confirmationRate"), value: stats.kpis.confirmation_rate ?? 0 },
    { label: t("dashboard.kpi.deliveryRate"), value: stats.kpis.delivery_rate ?? 0 },
    { label: t("dashboard.funnel.received"), value: stats.stage_counts.received },
    { label: t("dashboard.funnel.confirmed"), value: stats.stage_counts.confirmed },
    { label: t("dashboard.funnel.shipped"), value: stats.stage_counts.shipped },
    { label: t("dashboard.funnel.delivered"), value: stats.stage_counts.delivered },
  ];

  const productOpts: Opt[] = (products ?? []).map((p) => ({ value: p.id, label: p.name }));
  const wilayaOpts: Opt[] = (wilayas ?? []).map((w) => ({ value: String(w.code), label: `${w.code}-${w.name}` }));
  const agentOpts: Opt[] = agents.map((a) => ({ value: a.user_id, label: a.display_name ?? a.user_id.slice(0, 8) }));

  const spark = (pick: (d: DashboardStats["daily"][number]) => number) => stats.daily.map(pick);

  const wilayaRows: WilayaRow[] = stats.per_wilaya.map((w) => ({
    code: w.wilaya_code,
    name: w.wilaya_name,
    totalOrders: w.total_orders,
    confirmedOrders: w.confirmed_orders,
    deliveredOrders: w.delivered_orders,
    deliveryRate: w.delivery_rate,
    stopShippingManual: w.stop_shipping_manual,
    stopShippingAuto: w.stop_shipping_auto,
  }));

  const pnl = stats.pnl;
  const m = pnl ? pnlMetrics(pnl) : null;
  const prevM = prevStats?.pnl ? pnlMetrics(prevStats.pnl) : null;
  const netProfit = pnl?.net_profit ?? 0;
  const productsForForm = (products ?? []).map((p) => ({ id: p.id, name: p.name }));
  const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
  const ratio = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(2)}×`);
  const n = (c: { count: number | null }) => c.count ?? 0;
  const finance = (path: string, extra: Record<string, string | undefined> = {}) =>
    `/app/finance/${path}${financeQs({ from: filters.from, to: filters.to }, { product: filters.product, ...extra })}`;

  const be = m?.breakeven_delivery_pct ?? null;
  const breakEvenSub =
    be == null ? null : be > 100 ? t("dashboard.kpi2.breakEvenUnreachable") : t("dashboard.kpi2.breakEven", { pct: be });

  // 🚨 alerts: each is an icon + sentence + link (never color alone).
  const losingWilayas = stats.per_wilaya.filter((w) => w.stop_shipping_auto && !w.stop_shipping_manual);
  const alerts: { key: string; icon: typeof AlertTriangle; text: string; href: string }[] = [
    ...(m && be != null && m.delivery_rate != null && m.delivery_rate < be
      ? [
          {
            key: "be",
            icon: TrendingDown,
            text: be > 100 ? t("dashboard.kpi2.breakEvenUnreachable") : t("dashboard.alerts.belowBreakEven", { rate: m.delivery_rate, be }),
            href: ordersQs(filters, { delivery_status: "returned" }),
          },
        ]
      : []),
    ...(n(stuck) > 0
      ? [{ key: "stuck", icon: TimerOff, text: t("dashboard.alerts.stuck", { n: n(stuck), days: STUCK_DAYS }), href: "/app/orders/delivery" }]
      : []),
    ...lowStock.slice(0, 4).map((p) => ({
      key: `stock-${p.id}`,
      icon: PackageX,
      text: t("dashboard.alerts.lowStock", { name: p.name, stock: p.stock, min: p.low_stock_threshold }),
      href: `/app/products/${p.id}/stock`,
    })),
    ...lowBalances.map((b) => ({
      key: `bal-${b.account_id}`,
      icon: Landmark,
      text: t("dashboard.alerts.lowBalance", { name: b.name ?? "—" }),
      href: "/app/finance/accounts",
    })),
    ...losingWilayas.slice(0, 4).map((w) => ({
      key: `w-${w.wilaya_code}`,
      icon: MapPinOff,
      text: t("dashboard.alerts.losingWilaya", { name: `${w.wilaya_code}-${w.wilaya_name ?? ""}`, rate: w.delivery_rate ?? 0 }),
      href: ordersQs(filters, { wilaya_code: String(w.wilaya_code) }),
    })),
  ];

  const sectionTitle = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")}>
        <AddAdSpendModal products={productsForForm} rates={rates} />
        <ButtonLink href="/app/orders/new" variant="outline">
          {t("orders.new")}
        </ButtonLink>
      </PageHeader>

      {/* ⚡ Today — fixed, ignores the filters below */}
      <section className="space-y-2" aria-labelledby="today-title">
        <h2 id="today-title" className={sectionTitle}>
          {t("dashboard.today.title")}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <KpiTile
            icon={ShoppingCart}
            label={t("dashboard.today.ordersToday")}
            value={String(n(ordersToday))}
            sub={t("dashboard.today.vsYesterday", { n: n(ordersYesterday) })}
            href={`/app/orders/all?from=${todayIso}&to=${todayIso}`}
          />
          <KpiTile icon={PhoneCall} label={t("dashboard.today.toConfirm")} value={String(n(toConfirm))} hint={t("dashboard.hint.toConfirm")} href="/app/orders/confirmation" />
          <KpiTile icon={Truck} label={t("dashboard.today.toShip")} value={String(n(toShip))} hint={t("dashboard.hint.toShip")} href="/app/orders/delivery" />
          <KpiTile
            icon={Banknote}
            label={t("dashboard.today.cashToCollect")}
            value={formatCurrency(allTime?.cash_to_collect)}
            sub={t("dashboard.today.cashSub")}
            hint={t("dashboard.hint.cashToCollect")}
            href="/app/orders/cash"
          />
          <KpiTile
            icon={TimerOff}
            label={t("dashboard.today.stuck")}
            value={String(n(stuck))}
            tone={n(stuck) > 0 ? "danger" : undefined}
            sub={t("dashboard.today.stuckSub", { days: STUCK_DAYS })}
            hint={t("dashboard.hint.stuck")}
            href="/app/orders/delivery"
          />
        </div>
      </section>

      <DashboardFilterBar products={productOpts} wilayas={wilayaOpts} agents={agentOpts} />

      {/* 💰 Period KPIs — one money model (pnl_lines) */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12" aria-label={t("dashboard.kpi2.period")}>
        <KpiTile
          hero
          className="lg:col-span-4"
          icon={Wallet}
          label={t("dashboard.kpi.netProfit")}
          value={formatCurrency(pnl?.net_profit)}
          tone={netProfit >= 0 ? "success" : "danger"}
          delta={pctDelta(pnl?.net_profit, prevStats?.pnl?.net_profit)}
          spark={spark((d) => d.revenue_dzd - d.invested_dzd)}
          sub={
            <span className="space-y-0.5">
              <span className="block">{m?.margin_pct != null ? t("dashboard.kpi2.margin", { pct: m.margin_pct }) : "—"}</span>
              {breakEvenSub ? <span className="block">{breakEvenSub}</span> : null}
            </span>
          }
          hint={t("dashboard.hint.netProfit")}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:col-span-8">
          <KpiTile
            icon={Coins}
            label={t("dashboard.kpi.revenue")}
            value={formatCurrency(pnl?.revenue)}
            delta={pctDelta(pnl?.revenue, prevStats?.pnl?.revenue)}
            hint={t("dashboard.hint.revenue")}
            href={ordersQs(filters, { delivery_status: "delivered" })}
          />
          <KpiTile
            icon={Receipt}
            label={t("dashboard.kpi2.totalCosts")}
            value={formatCurrency(m?.total_costs)}
            delta={pctDelta(m?.total_costs, prevM?.total_costs)}
            goodWhen="down"
            hint={t("dashboard.hint.totalCosts")}
            href={finance("expenses")}
          />
          <KpiTile
            icon={Megaphone}
            label={t("dashboard.kpi2.roas")}
            value={ratio(m?.roas)}
            delta={pctDelta(m?.roas, prevM?.roas)}
            hint={t("dashboard.hint.roas")}
            href={finance("ad-spend")}
          />
          <KpiTile
            icon={Target}
            label={t("dashboard.kpi2.costPerDelivered")}
            value={formatCurrency(m?.cost_per_delivered)}
            delta={pctDelta(m?.cost_per_delivered, prevM?.cost_per_delivered)}
            goodWhen="down"
            hint={t("dashboard.hint.costPerDelivered")}
          />
          <KpiTile
            icon={Boxes}
            label={t("dashboard.kpi2.aov")}
            value={formatCurrency(m?.aov)}
            delta={pctDelta(m?.aov, prevM?.aov)}
            hint={t("dashboard.hint.aov")}
          />
          <KpiTile
            icon={PhoneCall}
            label={t("dashboard.kpi.confirmationRate")}
            value={pct(m?.confirmation_rate)}
            delta={pctDelta(m?.confirmation_rate, prevM?.confirmation_rate)}
            hint={t("dashboard.hint.confirmationRate")}
            href={ordersQs(filters, { confirmation_status: "confirmed" })}
          />
          <KpiTile
            icon={PackageCheck}
            label={t("dashboard.kpi.deliveryRate")}
            value={pct(m?.delivery_rate)}
            tone={be != null && m?.delivery_rate != null && m.delivery_rate < be ? "danger" : undefined}
            delta={pctDelta(m?.delivery_rate, prevM?.delivery_rate)}
            sub={breakEvenSub}
            hint={t("dashboard.hint.deliveryRate")}
            href={ordersQs(filters, { delivery_status: "delivered" })}
          />
          <KpiTile
            icon={Undo2}
            label={t("dashboard.kpi2.returnRate")}
            value={pct(m?.return_rate)}
            delta={pctDelta(m?.return_rate, prevM?.return_rate)}
            goodWhen="down"
            hint={t("dashboard.hint.returnRate")}
            href={ordersQs(filters, { delivery_status: "returned" })}
          />
        </div>
      </section>

      {/* 🧾 P&L waterfall + 📈 trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="card-surface space-y-4 rounded-xl p-5 lg:col-span-5">
          <h2 className="text-sm font-semibold">{t("dashboard.pnl.title")}</h2>
          {pnl ? (
            <PnlWaterfall
              pnl={pnl}
              labels={{
                revenue: t("dashboard.pnl.revenue"),
                cogs: t("dashboard.pnl.cogs"),
                returns: t("dashboard.pnl.returns"),
                ads: t("dashboard.pnl.ads"),
                expenses: t("dashboard.pnl.expenses"),
                fixed: t("dashboard.pnl.fixed"),
                net: t("dashboard.pnl.net"),
              }}
              hrefs={{
                revenue: ordersQs(filters, { delivery_status: "delivered" }),
                cogs: "/app/products",
                returns: ordersQs(filters, { delivery_status: "returned" }),
                ads: finance("ad-spend"),
                expenses: finance("expenses"),
                fixed: "/app/settings#fixed-fees",
              }}
            />
          ) : (
            <Empty>{t("dashboard.noData")}</Empty>
          )}
        </div>
        <div className="card-surface space-y-3 rounded-xl p-5 lg:col-span-7">
          <h2 className="text-sm font-semibold">{t("dashboard.timeChart.title")}</h2>
          <TimeChart daily={stats.daily} />
        </div>
      </div>

      {/* 🚨 alerts · funnel · my work */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="card-surface space-y-3 rounded-xl p-5 lg:col-span-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" />
            {t("dashboard.alerts.title")}
            {alerts.length ? <span className="num rounded-full bg-warning-bg px-1.5 text-xs text-warning">{alerts.length}</span> : null}
          </h2>
          {!alerts.length ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.alerts.none")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.key}>
                  <Link href={a.href} className="group flex items-center gap-3 py-2 text-sm">
                    <a.icon className="h-4 w-4 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1 truncate group-hover:underline">{a.text}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-faint rtl:rotate-180" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-surface space-y-3 rounded-xl p-5 lg:col-span-4">
          <h2 className="text-sm font-semibold">{t("dashboard.funnel.title")}</h2>
          <Funnel
            stages={stats.funnel.map((f) => {
              const stage = f.stage as "received" | "confirmed" | "shipped" | "delivered";
              // "shipped" is compound (confirmed + past wait_for_deposit) — no single-filter drill-through.
              const href =
                stage === "received"
                  ? ordersQs(filters)
                  : stage === "confirmed"
                    ? ordersQs(filters, { confirmation_status: "confirmed" })
                    : stage === "delivered"
                      ? ordersQs(filters, { delivery_status: "delivered" })
                      : undefined;
              return { label: t(`dashboard.funnel.${stage}`), count: f.count, href };
            })}
          />
        </div>

        <div className="space-y-6 lg:col-span-3">
          <div className="card-surface space-y-2 rounded-xl p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              {t("dashboard.myTasks.title")}
            </h2>
            {!myTasks?.length ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.myTasks.none")}</p>
            ) : (
              <ul className="space-y-1.5">
                {myTasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <ColorDot token={TASK_PRIORITY_TOKEN[task.priority]} />
                      <span className="truncate">{task.title}</span>
                    </span>
                    {task.due_date ? (
                      <span className={task.due_date < todayIso ? "num shrink-0 text-xs text-danger" : "num shrink-0 text-xs text-muted-foreground"}>
                        {formatDate(task.due_date)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Link href="/app/team/tasks" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {t("dashboard.myTasks.viewAll")}
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
          <div className="card-surface space-y-2 rounded-xl p-5">
            <h2 className="text-sm font-semibold">{t("dashboard.meeting.title")}</h2>
            {!nextMeeting ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.meeting.none")}</p>
            ) : (
              <div className="text-sm">
                <div className="font-medium">{nextMeeting.title}</div>
                <div className="text-muted-foreground">{formatDate(nextMeeting.scheduled_at)}</div>
              </div>
            )}
            <Link href="/app/team/meetings" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              {t("dashboard.meeting.viewTeam")}
              <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.statusBreakdown.confirmationTitle")}</h2>
          <StatusBreakdownBars
            kind="confirmation"
            rows={stats.confirmation_breakdown}
            emptyLabel={t("dashboard.noData")}
            hrefFor={(status) => ordersQs(filters, { confirmation_status: status })}
          />
        </div>
        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.statusBreakdown.deliveryTitle")}</h2>
          <StatusBreakdownBars
            kind="delivery"
            rows={stats.delivery_breakdown}
            emptyLabel={t("dashboard.noData")}
            hrefFor={(status) => ordersQs(filters, { delivery_status: status })}
          />
        </div>
      </div>

      <WilayaSection rows={wilayaRows} minOrders={stats.stop_shipping_min_orders} filters={filters} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="card-surface overflow-hidden rounded-xl">
          <h2 className="p-5 pb-0 text-sm font-semibold">{t("dashboard.byAgent.title")}</h2>
          {!stats.per_agent.length ? (
            <div className="p-5">
              <Empty>{t("dashboard.noData")}</Empty>
            </div>
          ) : (
            <div className="overflow-x-auto p-5 pt-3">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("fields.agent")}</th>
                    <th>{t("dashboard.byAgent.stage")}</th>
                    <th>{t("common.total")}</th>
                    <th>{t("dashboard.funnel.confirmed")}/{t("dashboard.funnel.delivered")}</th>
                    <th>{t("dashboard.byAgent.avgDecisionTime")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.per_agent.map((a, i) => {
                    const done = a.stage === "confirmation" ? a.confirmed : a.delivered;
                    const rate = a.orders_handled > 0 ? (100 * done) / a.orders_handled : 0;
                    const secs = a.avg_decision_seconds;
                    return (
                      <tr key={`${a.user_id}-${a.stage}-${i}`}>
                        <td>
                          <Link href={ordersQs(filters, { agent: a.user_id })} className="hover:underline">
                            {a.display_name ?? a.user_id.slice(0, 8)}
                          </Link>
                        </td>
                        <td className="capitalize">{a.stage}</td>
                        <td className="num">{a.orders_handled}</td>
                        <td className="min-w-28">
                          <RateCell pct={rate} label={`${done}/${a.orders_handled}`} labelWidth="w-14" />
                        </td>
                        <td className="num whitespace-nowrap">
                          {secs != null ? formatDuration(`${Math.floor(secs / 3600)}:${Math.floor((secs % 3600) / 60)}:00`) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card-surface overflow-hidden rounded-xl">
          <h2 className="p-5 pb-0 text-sm font-semibold">{t("dashboard.byProduct.title")}</h2>
          {!stats.per_product.length ? (
            <div className="p-5">
              <Empty>{t("dashboard.noData")}</Empty>
            </div>
          ) : (
            <div className="overflow-x-auto p-5 pt-3">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("fields.product")}</th>
                    <th>{t("dashboard.kpi.deliveryRate")}</th>
                    <th className="text-end">{t("dashboard.kpi.revenue")}</th>
                    <th className="text-end">{t("dashboard.kpi2.roas")}</th>
                    <th className="text-end">{t("dashboard.kpi.netProfit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.per_product.map((p) => {
                    const pp = pnlByProduct.get(p.product_id);
                    const pm = pp ? pnlMetrics(pp) : null;
                    return (
                      <tr key={p.product_id}>
                        <td>
                          <Link href={`/app/products/${p.product_id}/statistics`} className="hover:underline">
                            {p.name}
                          </Link>
                        </td>
                        <td className="min-w-28">
                          <RateCell pct={p.delivery_rate ?? 0} label={pct(p.delivery_rate)} />
                        </td>
                        <td className="num whitespace-nowrap text-end">{formatCurrency(p.revenue_dzd)}</td>
                        <td className="num whitespace-nowrap text-end">{ratio(pm?.roas)}</td>
                        <td className={`num whitespace-nowrap text-end ${(pp?.net_profit ?? 0) >= 0 ? "text-success" : "text-danger"}`}>
                          {formatCurrency(pp?.net_profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="card-surface space-y-3 rounded-xl p-5 lg:col-span-8">
          <h2 className="text-sm font-semibold">{t("dashboard.categorySpending.title")}</h2>
          <CategoryBars
            rows={stats.category_spending.map((c) => ({ category: c.category, label: t(`status.expense_category.${c.category}`), amount_dzd: c.amount_dzd }))}
            hrefFor={(category) => finance("expenses", { category })}
            emptyLabel={t("dashboard.noData")}
          />
        </div>
        <div className="card-surface space-y-3 rounded-xl p-5 lg:col-span-4">
          <DashboardExportButtons orders={exportRows} summary={summaryRows} />
          <Link href="/app/finance/expenses" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {t("expenses.new")}
            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </div>
  );
}
