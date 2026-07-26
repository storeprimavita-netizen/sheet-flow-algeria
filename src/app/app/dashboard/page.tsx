import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import type { Enums } from "@/lib/supabase/database.types";
import { formatCurrency, formatDate } from "@/lib/format";
import { ORDER_SOURCES } from "@/lib/enums";
import { Field, tableClass } from "@/components/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/button-link";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Badge } from "@/components/ui/badge";
import { AdSpendEntry } from "@/components/ad-spend-entry";
import { DashboardExportButtons, type OrderExportRow } from "./export-button";

// Dashboard is admin-only (AdminGuardLayout redirects agents to /app/orders —
// Phase 1's "agents see only Orders, nothing else" per SPEC §2). The RPC
// still gates money fields behind is_admin() as a second layer (RLS is the
// wall, UI is cosmetic), but there is no agent-facing view to build here:
// agents get their queue counts + personal stats from the Orders queues
// themselves (Phase 5), not from this route.

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
};

function Bar({ pct, className = "bg-primary" }: { pct: number; className?: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function hours(seconds: number | null): string {
  if (seconds === null) return "—";
  return `${(seconds / 3600).toFixed(1)}h`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" && sp[k] ? sp[k] : "");
  const getArr = (k: string): string[] => {
    const v = sp[k];
    if (!v) return [];
    return Array.isArray(v) ? v : [v];
  };
  const MULTI_KEYS = ["product", "wilaya", "source", "conf_agent", "deliv_agent"];

  const t = await getTranslations();
  const profile = (await getProfile())!;
  const supabase = await createClient();

  const [{ data: products }, { data: wilayas }, { data: team }, { data: nextMeeting }] = await Promise.all([
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
  ]);
  const confirmationAgents = (team ?? []).filter((a) => a.role === "confirmation_agent");
  const deliveryAgents = (team ?? []).filter((a) => a.role === "delivery_agent");

  const filters = {
    p_from: get("from") || undefined,
    p_to: get("to") || undefined,
    p_product: getArr("product").length ? getArr("product") : undefined,
    p_wilaya: getArr("wilaya").length ? getArr("wilaya").map(Number) : undefined,
    p_source: getArr("source").length ? (getArr("source") as Enums<"order_source">[]) : undefined,
    p_conf_agent: getArr("conf_agent").length ? getArr("conf_agent") : undefined,
    p_deliv_agent: getArr("deliv_agent").length ? getArr("deliv_agent") : undefined,
  };

  const [{ data: rpcData }, usdRate, eurRate] = await Promise.all([
    supabase.rpc("dashboard_stats", filters),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
  ]);
  const stats = rpcData as unknown as DashboardStats;
  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };

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
  if (filters.p_from) orderQuery = orderQuery.gte("placed_at", filters.p_from);
  if (filters.p_to) orderQuery = orderQuery.lte("placed_at", `${filters.p_to}T23:59:59`);
  if (filters.p_product) orderQuery = orderQuery.in("product_id", filters.p_product);
  if (filters.p_wilaya) orderQuery = orderQuery.in("wilaya_code", filters.p_wilaya);
  if (filters.p_source) orderQuery = orderQuery.in("source", filters.p_source);
  if (filters.p_conf_agent) orderQuery = orderQuery.in("assigned_confirmation_agent", filters.p_conf_agent);
  if (filters.p_deliv_agent) orderQuery = orderQuery.in("assigned_delivery_agent", filters.p_deliv_agent);
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

  const today = new Date().toISOString().slice(0, 10);
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

  const presetQs = (from: string, to: string) => {
    const params = new URLSearchParams();
    for (const k of MULTI_KEYS) for (const v of getArr(k)) params.append(k, v);
    params.set("from", from);
    params.set("to", to);
    return `?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("dashboard.title")} subtitle={t("dashboard.subtitle")} />

      {/* filter bar */}
      <form method="get" className="glass-card space-y-3 rounded-xl p-4">
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={presetQs(today, today)} variant="outline" size="sm">
            {t("dashboard.filters.today")}
          </ButtonLink>
          <ButtonLink href={presetQs(daysAgo(6), today)} variant="outline" size="sm">
            {t("dashboard.filters.last7")}
          </ButtonLink>
          <ButtonLink href={presetQs(daysAgo(29), today)} variant="outline" size="sm">
            {t("dashboard.filters.last30")}
          </ButtonLink>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <Field label={t("fields.from")}>
            <Input type="date" name="from" defaultValue={get("from")} />
          </Field>
          <Field label={t("fields.to")}>
            <Input type="date" name="to" defaultValue={get("to")} />
          </Field>
          <Field label={t("fields.product")}>
            <Select name="product" multiple defaultValue={getArr("product")} className="h-20">
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.wilaya")}>
            <Select name="wilaya" multiple defaultValue={getArr("wilaya")} className="h-20">
              {(wilayas ?? []).map((w) => (
                <option key={w.code} value={w.code}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.source")}>
            <Select name="source" multiple defaultValue={getArr("source")} className="h-20">
              {ORDER_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.order_source.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("workbench.assignConfirmation")}>
            <Select name="conf_agent" multiple defaultValue={getArr("conf_agent")} className="h-20">
              {confirmationAgents.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.display_name ?? a.user_id.slice(0, 8)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("workbench.assignDelivery")}>
            <Select name="deliv_agent" multiple defaultValue={getArr("deliv_agent")} className="h-20">
              {deliveryAgents.map((a) => (
                <option key={a.user_id} value={a.user_id}>
                  {a.display_name ?? a.user_id.slice(0, 8)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit">{t("actions.search")}</Button>
          <ButtonLink href="/app/dashboard" variant="ghost">
            {t("actions.cancel")}
          </ButtonLink>
        </div>
      </form>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          [t("dashboard.kpi.revenue"), formatCurrency(stats.kpis.revenue_dzd)],
          [t("dashboard.kpi.invested"), formatCurrency(stats.kpis.invested_dzd)],
          [t("dashboard.kpi.netProfit"), formatCurrency(stats.kpis.net_profit_dzd)],
          [t("dashboard.kpi.confirmationRate"), stats.kpis.confirmation_rate !== null ? `${stats.kpis.confirmation_rate}%` : "—"],
          [t("dashboard.kpi.deliveryRate"), stats.kpis.delivery_rate !== null ? `${stats.kpis.delivery_rate}%` : "—"],
        ].map(([label, value]) => (
          <div key={label} className="glass-card rounded-xl p-4">
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {/* funnel */}
      <div className="glass-card space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("dashboard.funnel.title")}</h2>
        {stats.funnel.map((f, i) => {
          const prev = i > 0 ? stats.funnel[i - 1].count : null;
          const dropOff = prev && prev > 0 ? Math.round(100 * (1 - f.count / prev)) : null;
          const pct = stats.stage_counts.received > 0 ? (100 * f.count) / stats.stage_counts.received : 0;
          return (
            <div key={f.stage} className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t(`dashboard.funnel.${f.stage as "received" | "confirmed" | "shipped" | "delivered"}`)}</span>
                <span>
                  {f.count}
                  {dropOff !== null ? ` · -${dropOff}% ${t("dashboard.funnel.dropOff")}` : ""}
                </span>
              </div>
              <Bar pct={pct} />
            </div>
          );
        })}
      </div>

      {/* per-wilaya */}
      <div className="glass-card overflow-hidden rounded-xl">
        <h2 className="p-5 pb-0 text-sm font-semibold">{t("dashboard.wilaya.title")}</h2>
        {!stats.per_wilaya.length ? (
          <div className="p-5">
            <Empty>{t("dashboard.noData")}</Empty>
          </div>
        ) : (
          <div className="overflow-x-auto p-5 pt-3">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.wilaya")}</th>
                  <th>{t("common.total")}</th>
                  <th>{t("dashboard.funnel.confirmed")}</th>
                  <th>{t("dashboard.funnel.delivered")}</th>
                  <th>{t("dashboard.kpi.deliveryRate")}</th>
                  <th>{t("dashboard.wilaya.stopShippingManual")}</th>
                  <th>{t("dashboard.wilaya.stopShippingAuto")}</th>
                </tr>
              </thead>
              <tbody>
                {stats.per_wilaya.map((w) => (
                  <tr key={w.wilaya_code}>
                    <td>{w.wilaya_name ?? w.wilaya_code}</td>
                    <td>{w.total_orders}</td>
                    <td>{w.confirmed_orders}</td>
                    <td>{w.delivered_orders}</td>
                    <td className="min-w-32">
                      <div className="flex items-center gap-2">
                        <Bar pct={w.delivery_rate ?? 0} />
                        <span className="w-10 shrink-0 text-end text-xs">
                          {w.delivery_rate !== null ? `${w.delivery_rate}%` : "—"}
                        </span>
                      </div>
                    </td>
                    <td>{w.stop_shipping_manual ? <Badge variant="destructive">🚫</Badge> : "—"}</td>
                    <td>{w.stop_shipping_auto ? <Badge variant="destructive">🚫</Badge> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* per-agent */}
        <div className="glass-card overflow-hidden rounded-xl">
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
                  {stats.per_agent.map((a, i) => (
                    <tr key={`${a.user_id}-${a.stage}-${i}`}>
                      <td>{a.display_name ?? a.user_id.slice(0, 8)}</td>
                      <td className="capitalize">{a.stage}</td>
                      <td>{a.orders_handled}</td>
                      <td>
                        {a.stage === "confirmation" ? a.confirmed : a.delivered}/{a.orders_handled}
                      </td>
                      <td>{hours(a.avg_decision_seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* per-product */}
        <div className="glass-card overflow-hidden rounded-xl">
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
                      <td>{p.name}</td>
                      <td>{p.confirmation_rate !== null ? `${p.confirmation_rate}%` : "—"}</td>
                      <td>{p.delivery_rate !== null ? `${p.delivery_rate}%` : "—"}</td>
                      <td>{formatCurrency(p.revenue_dzd)}</td>
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
        <div className="glass-card space-y-3 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.categorySpending.title")}</h2>
          {!stats.category_spending.length ? (
            <Empty>{t("dashboard.noData")}</Empty>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.category_spending.map((c) => (
                <li key={c.category} className="flex justify-between">
                  <span className="text-muted-foreground">{t(`status.expense_category.${c.category}`)}</span>
                  <span>{formatCurrency(c.amount_dzd)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* next meeting */}
        <div className="glass-card space-y-2 rounded-xl p-5">
          <h2 className="text-sm font-semibold">{t("dashboard.meeting.title")}</h2>
          {!nextMeeting ? (
            <p className="text-sm text-muted-foreground">{t("dashboard.meeting.none")}</p>
          ) : (
            <div className="text-sm">
              <div className="font-medium">{nextMeeting.title}</div>
              <div className="text-muted-foreground">{formatDate(nextMeeting.scheduled_at)}</div>
            </div>
          )}
          <Link href="/app/team" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {t("dashboard.meeting.viewTeam")}
            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>
      </div>

      <AdSpendEntry products={products ?? []} rates={rates} />

      <DashboardExportButtons orders={exportRows} summary={summaryRows} />
    </div>
  );
}
