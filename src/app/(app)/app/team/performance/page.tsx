import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { formatDuration } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { TeamTabs } from "../team-tabs";
import { PerformanceFilterBar } from "./performance-filter-bar";
import { PerformanceTable, type PerfRow } from "./performance-table";

/** Postgres-interval-shaped string from a millisecond average, so the
 * existing `formatDuration()` parser (built for the `agent_performance`
 * view's interval column) can render the date-filtered path too — one
 * duration formatter, not two. */
function msToIntervalText(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const rem = totalSeconds % 86400;
  const h = Math.floor(rem / 3600);
  const m = Math.floor((rem % 3600) / 60);
  const s = rem % 60;
  return `${days} days ${h}:${m}:${s}`;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const from = typeof sp.from === "string" ? sp.from : "";
  const to = typeof sp.to === "string" ? sp.to : "";

  const t = await getTranslations();
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .eq("workspace_id", workspaceId);
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? p.user_id]));

  let rows: PerfRow[];
  let strip: { decision: string | null; delivery: string | null; total: string | null };
  if (from || to) {
    // Date-windowed: re-derive the view's own aggregation from the raw
    // history (a view can't take a date param), same grouping/filters as
    // `agent_performance` (00006_analytics.sql).
    let query = supabase
      .from("order_status_history")
      .select("actor, stage, to_status, created_at, order_id, order:orders(created_at)")
      .not("actor", "is", null);
    if (from) query = query.gte("created_at", from);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);
    const { data: history } = await query;

    // The confirmed crossing that anchors delivery time often predates the
    // window, so fetch it unwindowed for every order seen in-window.
    const orderIds = [...new Set((history ?? []).map((h) => h.order_id))];
    const { data: confRows } = await (orderIds.length
      ? supabase
          .from("order_status_history")
          .select("order_id, created_at")
          .in("order_id", orderIds)
          .eq("stage", "confirmation")
          .eq("to_status", "confirmed")
      : Promise.resolve({ data: [] as never[] }));
    const confByOrder = new Map<string, string[]>();
    for (const c of confRows ?? []) {
      const list = confByOrder.get(c.order_id) ?? [];
      list.push(c.created_at);
      confByOrder.set(c.order_id, list);
    }

    // Key on actor+stage without concatenating them into one string — a UUID
    // already contains "-", so splitting a joined key back apart is unsafe.
    type Group = {
      userId: string;
      stage: "confirmation" | "delivery";
      handled: Set<string>;
      confirmed: number;
      delivered: number;
      lost: number;
      decisionMs: number[];
      deliveryMs: number[];
      totalMs: number[];
    };
    const wsDecisionMs: number[] = [];
    const wsDeliveryMs: number[] = [];
    const wsTotalMs: number[] = [];
    const groups = new Map<string, Group>();
    for (const h of history ?? []) {
      if (!h.actor) continue;
      const key = `${h.actor} ${h.stage}`;
      const g: Group =
        groups.get(key) ?? {
          userId: h.actor,
          stage: h.stage as "confirmation" | "delivery",
          handled: new Set<string>(),
          confirmed: 0,
          delivered: 0,
          lost: 0,
          decisionMs: [],
          deliveryMs: [],
          totalMs: [],
        };
      g.handled.add(h.order_id);
      if (h.to_status === "confirmed") g.confirmed += 1;
      if (h.to_status === "delivered") g.delivered += 1;
      if (h.to_status === "cancelled" || h.to_status === "returned") g.lost += 1;
      if ((h.to_status === "confirmed" || h.to_status === "cancelled") && h.order?.created_at) {
        const ms = new Date(h.created_at).getTime() - new Date(h.order.created_at).getTime();
        g.decisionMs.push(ms);
        wsDecisionMs.push(ms);
      }
      if (h.to_status === "delivered") {
        const deliveredTs = new Date(h.created_at).getTime();
        // Latest confirmed crossing at or before this delivery (free
        // transitions allow confirm→reopen→reconfirm cycles).
        const anchors = (confByOrder.get(h.order_id) ?? [])
          .map((c) => new Date(c).getTime())
          .filter((c) => c <= deliveredTs);
        if (anchors.length) {
          const ms = deliveredTs - Math.max(...anchors);
          g.deliveryMs.push(ms);
          wsDeliveryMs.push(ms);
        }
        if (h.order?.created_at) {
          const ms = deliveredTs - new Date(h.order.created_at).getTime();
          g.totalMs.push(ms);
          wsTotalMs.push(ms);
        }
      }
      groups.set(key, g);
    }
    const avg = (a: number[]) => (a.length ? msToIntervalText(a.reduce((x, y) => x + y, 0) / a.length) : null);

    rows = [...groups.values()].map((g) => {
      const won = g.stage === "delivery" ? g.delivered : g.confirmed;
      const handled = g.handled.size;
      return {
        user_id: g.userId,
        name: nameById.get(g.userId) ?? g.userId,
        stage: g.stage,
        orders_handled: handled,
        won,
        rate: handled > 0 ? Math.round((won / handled) * 100) : null,
        lost: g.lost,
        avg_decision_time: avg(g.decisionMs),
        avg_delivery_time: avg(g.deliveryMs),
        avg_total_time: avg(g.totalMs),
      };
    });
    strip = { decision: avg(wsDecisionMs), delivery: avg(wsDeliveryMs), total: avg(wsTotalMs) };
  } else {
    const [{ data }, { data: wp }] = await Promise.all([
      supabase.from("agent_performance").select("*").eq("workspace_id", workspaceId),
      supabase.from("workspace_performance").select("*").eq("workspace_id", workspaceId).maybeSingle(),
    ]);
    rows = (data ?? [])
      .filter((r): r is typeof r & { user_id: string; stage: string } => Boolean(r.user_id && r.stage))
      .map((r) => {
        const handled = r.orders_handled ?? 0;
        const won = r.stage === "delivery" ? (r.delivered ?? 0) : (r.confirmed ?? 0);
        return {
          user_id: r.user_id,
          name: nameById.get(r.user_id) ?? r.user_id,
          stage: r.stage as "confirmation" | "delivery",
          orders_handled: handled,
          won,
          rate: handled > 0 ? Math.round((won / handled) * 100) : null,
          lost: r.lost ?? 0,
          avg_decision_time: r.avg_decision_time,
          avg_delivery_time: r.avg_delivery_time,
          avg_total_time: r.avg_total_time,
        };
      });
    strip = {
      decision: wp?.avg_decision_time ?? null,
      delivery: wp?.avg_delivery_time ?? null,
      total: wp?.avg_total_time ?? null,
    };
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="performance" />
      <PerformanceFilterBar />
      <div className="card-surface flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl p-5">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{t("team.workspaceAverage")}</div>
        <Stat label={t("team.avgDecisionTime")} value={formatDuration(strip.decision)} />
        <Stat label={t("team.avgDeliveryTime")} value={formatDuration(strip.delivery)} />
        <Stat label={t("team.avgTotalTime")} value={formatDuration(strip.total)} />
      </div>
      <PerformanceTable rows={rows} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}
