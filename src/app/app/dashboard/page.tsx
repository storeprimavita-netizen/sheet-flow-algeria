import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, ListTodo } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import type { Enums } from "@/lib/supabase/database.types";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { ColorDot } from "@/components/ui/chip";
import { TASK_PRIORITY_TOKEN } from "@/lib/statuses";
import { ButtonLink } from "@/components/button-link";
import { KpiTile } from "@/components/stats/kpi-tile";
import { Funnel } from "@/components/stats/funnel";
import { RateCell } from "@/components/stats/rate-bar";
import { TimeChart } from "@/components/dashboard/time-chart";
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
};

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

  const netProfit = stats.kpis.net_profit_dzd ?? 0;
  const productsForForm = (products ?? []).map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />

      <DashboardFilterBar products={productOpts} wilayas={wilayaOpts} agents={agentOpts} />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiTile
          label={t("dashboard.kpi.revenue")}
          value={formatCurrency(stats.kpis.revenue_dzd)}
          tone="success"
          delta={pctDelta(stats.kpis.revenue_dzd, prevStats?.kpis.revenue_dzd)}
          spark={spark((d) => d.revenue_dzd)}
          href={ordersQs(filters, { delivery_status: "delivered" })}
        />
        <KpiTile
          label={t("dashboard.kpi.invested")}
          value={formatCurrency(stats.kpis.invested_dzd)}
          tone="danger"
          delta={pctDelta(stats.kpis.invested_dzd, prevStats?.kpis.invested_dzd)}
          spark={spark((d) => d.invested_dzd)}
          href={`/app/finance/expenses${financeQs({ from: filters.from, to: filters.to }, { product: filters.product })}`}
        />
        <KpiTile
          label={t("dashboard.kpi.netProfit")}
          value={formatCurrency(stats.kpis.net_profit_dzd)}
          tone={netProfit >= 0 ? "success" : "danger"}
          delta={pctDelta(stats.kpis.net_profit_dzd, prevStats?.kpis.net_profit_dzd)}
          spark={spark((d) => d.revenue_dzd - d.invested_dzd)}
        />
        <KpiTile
          label={t("dashboard.kpi.confirmationRate")}
          value={stats.kpis.confirmation_rate !== null ? `${stats.kpis.confirmation_rate}%` : "—"}
          delta={pctDelta(stats.kpis.confirmation_rate, prevStats?.kpis.confirmation_rate)}
          spark={spark((d) => (d.orders_received > 0 ? (100 * d.orders_confirmed) / d.orders_received : 0))}
          href={ordersQs(filters)}
        />
        <KpiTile
          label={t("dashboard.kpi.deliveryRate")}
          value={stats.kpis.delivery_rate !== null ? `${stats.kpis.delivery_rate}%` : "—"}
          delta={pctDelta(stats.kpis.delivery_rate, prevStats?.kpis.delivery_rate)}
          spark={spark((d) => (d.orders_confirmed > 0 ? (100 * d.orders_delivered) / d.orders_confirmed : 0))}
          href={ordersQs(filters, { delivery_status: "delivered" })}
        />
        <KpiTile
          label={t("dashboard.kpi.orders")}
          value={String(stats.stage_counts.received)}
          delta={pctDelta(stats.stage_counts.received, prevStats?.stage_counts.received)}
          spark={spark((d) => d.orders_received)}
          href={ordersQs(filters)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* funnel */}
        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.funnel.title")}</h2>
          <Funnel
            stages={stats.funnel.map((f) => ({
              label: t(`dashboard.funnel.${f.stage as "received" | "confirmed" | "shipped" | "delivered"}`),
              count: f.count,
            }))}
          />
        </div>

        {/* profit/spend over time */}
        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.timeChart.title")}</h2>
          <TimeChart daily={stats.daily} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* confirmation status breakdown */}
        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.statusBreakdown.confirmationTitle")}</h2>
          <StatusBreakdownBars kind="confirmation" rows={stats.confirmation_breakdown} emptyLabel={t("dashboard.noData")} />
        </div>

        {/* delivery status breakdown */}
        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.statusBreakdown.deliveryTitle")}</h2>
          <StatusBreakdownBars kind="delivery" rows={stats.delivery_breakdown} emptyLabel={t("dashboard.noData")} />
        </div>
      </div>

      {/* per-wilaya table + choropleth */}
      <WilayaSection rows={wilayaRows} minOrders={stats.stop_shipping_min_orders} filters={filters} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* per-agent */}
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
                    const pct = a.orders_handled > 0 ? (100 * done) / a.orders_handled : 0;
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
                          <RateCell pct={pct} label={`${done}/${a.orders_handled}`} labelWidth="w-14" />
                        </td>
                        <td className="num">{a.avg_decision_seconds != null ? `${(a.avg_decision_seconds / 3600).toFixed(1)}h` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* per-product */}
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
                    <th>{t("dashboard.kpi.confirmationRate")}</th>
                    <th>{t("dashboard.kpi.deliveryRate")}</th>
                    <th>{t("dashboard.kpi.revenue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.per_product.map((p) => (
                    <tr key={p.product_id}>
                      <td>
                        <Link href={`/app/products/${p.product_id}/statistics`} className="hover:underline">
                          {p.name}
                        </Link>
                      </td>
                      <td className="min-w-28">
                        <RateCell pct={p.confirmation_rate ?? 0} label={p.confirmation_rate !== null ? `${p.confirmation_rate}%` : "—"} />
                      </td>
                      <td className="min-w-28">
                        <RateCell pct={p.delivery_rate ?? 0} label={p.delivery_rate !== null ? `${p.delivery_rate}%` : "—"} />
                      </td>
                      <td className="num">{formatCurrency(p.revenue_dzd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* category spending */}
        <div className="card-surface space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.categorySpending.title")}</h2>
          <CategoryBars
            rows={stats.category_spending.map((c) => ({ category: c.category, label: t(`status.expense_category.${c.category}`), amount_dzd: c.amount_dzd }))}
            hrefFor={(category) => `/app/finance/expenses${financeQs({ from: filters.from, to: filters.to }, { category, product: filters.product })}`}
            emptyLabel={t("dashboard.noData")}
          />
        </div>

        {/* next meeting */}
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

      {/* my open tasks */}
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
                  <span
                    className={
                      task.due_date < new Date().toISOString().slice(0, 10) ? "num shrink-0 text-xs text-danger" : "num shrink-0 text-xs text-muted-foreground"
                    }
                  >
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

      {/* quick actions */}
      <div className="card-surface space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("dashboard.quickActions.title")}</h2>
        <div className="flex flex-wrap gap-2">
          <AddAdSpendModal products={productsForForm} rates={rates} />
          <ButtonLink href="/app/orders/new" variant="outline">
            {t("orders.new")}
          </ButtonLink>
          <ButtonLink href="/app/finance/expenses" variant="outline">
            {t("expenses.new")}
          </ButtonLink>
        </div>
      </div>

      <DashboardExportButtons orders={exportRows} summary={summaryRows} />
    </div>
  );
}
