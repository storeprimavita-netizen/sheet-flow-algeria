import { getLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/rbac";
import { customerScoreScope, scoreSummary } from "./_lib/customer-score";
import { formatRelativeTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { ACTIONABLE_CONFIRMATION } from "@/lib/statuses";
import { formatAlgiersDateTime } from "./_lib/callback";
import { OrderTabs } from "../orders/order-tabs";
import { effectiveConfig, FILTER_KEYS, isDirty, presentationDirty, viewPresentation, serializeConfig } from "@/lib/order-views";
import { applyOrderConfig, applyQueueSlice, CONFIRMED_EVENT_SELECT, orderSort, ROW_LIMIT } from "../orders/_lib/order-query";
import { listViews, resolveView } from "../orders/_lib/views-data";
import { InvalidViewNotice, ViewTabs } from "../orders/view-tabs";
import { QueueFilterBar } from "../orders/queue-filter-bar";
import { CONFIRMATION_STATUSES } from "@/lib/enums";
import { ConfirmationTable, type ConfRow } from "./confirmation-table";
import { NewOrdersPill } from "./new-orders-pill";
import { OrderBoardLoadError, OrderKanban } from "../orders/order-kanban";
import { OrderBoardEmpty } from "../orders/order-board-empty";
import { boardResetHref, boardShowClosedHref, type KanbanRow } from "../orders/_lib/kanban";

const rest = (sp: Record<string, string | string[] | undefined>) =>
  new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "view" ? [[k, v]] : []))).toString();

const shipped = (zr: unknown) => (Array.isArray(zr) ? zr.length > 0 : !!zr);

export default async function ConfirmationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const showAll = sp.show === "all";
  const t = await getTranslations();
  const supabase = await createClient();
  const [profile, user] = await Promise.all([getProfile(), getUser()]);
  const isAdmin = profile?.role === "admin";
  const scoreScope = user && profile && (isAdmin || profile.role === "confirmation_agent")
    ? customerScoreScope(user.id, profile.workspaceId, profile.role)
    : null;

  const viewsResult = await listViews("confirmation");
  const { active, invalid } = resolveView(viewsResult.views, sp.view);
  const cfg = effectiveConfig(active?.config ?? null, sp);
  const presentation = viewPresentation("confirmation", isAdmin, active, sp);
  const dirty = !!active && (isDirty(active.config, sp) || presentationDirty(viewPresentation("confirmation", isAdmin, active), presentation));
  const slice = cfg.queue_slice;
  const now = new Date();

  const columns = "id, order_seq, customer_id, customer_name, customer_phone, quantity, sale_price, confirmation_status, confirmation_comment, confirmation_attempts, commune, placed_at, is_duplicate_suspect, duplicate_of, delivery_status, callback_at, product_id, wilaya_code, product:products(name), wilaya:wilayas(name), zr:zr_shipments(order_id)";
  // Default = actionable only (same list as the sidebar badge); "show closed"
  // adds cancelled. Confirmed orders live in the delivery queue.
  let query = supabase
    .from("orders")
    .select((slice === "confirmed_today" ? `${columns}${CONFIRMED_EVENT_SELECT}` : columns) as typeof columns);
  query = applyOrderConfig(query, cfg);
  // oldest first unless the view sorts; the page's own filter below is applied last, so a view can only narrow
  const sort = cfg.sort ? orderSort(cfg)
    : { column: slice === "callbacks_due" ? "callback_at" : "created_at", ascending: true };
  query = query.order(sort.column, { ascending: sort.ascending });
  if (slice === "callbacks_due") query = query.order("id", { ascending: true });
  if (slice !== "confirmed_today") {
    query = showAll && !slice ? query.neq("confirmation_status", "confirmed") : query.in("confirmation_status", ACTIONABLE_CONFIRMATION);
  }
  if (slice) query = applyQueueSlice(query, slice, now);
  const { data: orders, error: ordersError } = await query;

  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id).filter((id): id is string => !!id))];

  const [{ data: stats }, { data: history }] = await Promise.all([
    customerIds.length
      ? supabase.from("customer_stats").select("id, total_orders, risk_score, risk_state, risk_reason, returned_orders, cancelled_orders, no_answer_orders").in("id", customerIds)
      : Promise.resolve({ data: [] as never[] }),
    customerIds.length
      ? supabase
          .from("orders")
          .select("id, order_seq, customer_id, delivery_status, placed_at")
          .in("customer_id", customerIds)
          .order("placed_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const statById = new Map((stats ?? []).map((s) => [s.id, s]));
  const historyByCustomer = new Map<string, ConfRow["recent"]>();
  for (const h of history ?? []) {
    if (!h.customer_id) continue;
    const list = historyByCustomer.get(h.customer_id) ?? [];
    list.push({ id: h.id, order_seq: h.order_seq, delivery_status: h.delivery_status, placed_at: h.placed_at });
    historyByCustomer.set(h.customer_id, list);
  }

  const rows: ConfRow[] = (orders ?? []).map((o) => {
    const stat = o.customer_id ? statById.get(o.customer_id) : undefined;
    const recent = (o.customer_id ? historyByCustomer.get(o.customer_id) ?? [] : [])
      .filter((h) => h.id !== o.id)
      .slice(0, 5);
    const risk = scoreSummary.safeParse({
      score: stat?.risk_score,
      state: stat?.risk_state,
      reason: stat?.risk_reason,
      total: stat?.total_orders,
      returned: stat?.returned_orders,
      cancelled: stat?.cancelled_orders,
      noAnswer: stat?.no_answer_orders,
    });
    return {
      id: o.id,
      order_seq: o.order_seq,
      customer_id: o.customer_id,
      customer_name: o.customer_name,
      customer_phone: o.customer_phone,
      product_name: o.product?.name ?? null,
      quantity: o.quantity,
      sale_price: o.sale_price,
      confirmation_status: o.confirmation_status,
      confirmation_comment: o.confirmation_comment,
      confirmation_attempts: o.confirmation_attempts ?? 0,
      commune: o.commune,
      placed_at: o.placed_at,
      is_duplicate_suspect: o.is_duplicate_suspect ?? false,
      duplicate_of: o.duplicate_of,
      risk: risk.success ? risk.data : null,
      scopedHistory: !isAdmin,
      recent,
      callback_at: o.callback_at,
      callback_due: !!o.callback_at && Date.parse(o.callback_at) <= now.getTime(),
      can_callback: !!scoreScope && (ACTIONABLE_CONFIRMATION as readonly string[]).includes(o.confirmation_status)
        && o.delivery_status === "wait_for_deposit" && !shipped(o.zr),
      // shipped orders: agents may not log attempts (DB already blocks writes, 00025)
      locked: !isAdmin && (o.delivery_status !== "wait_for_deposit" || shipped(o.zr)),
    };
  });

  const boardRows: KanbanRow[] = [];
  if (presentation.layout === "kanban" && orders) {
    const locale = await getLocale();
    for (const [index, order] of orders.entries()) {
      const row = rows[index];
      boardRows.push({
        id: row.id, orderSeq: row.order_seq, customerName: row.customer_name, customerPhone: row.customer_phone,
        productId: order.product_id, productName: row.product_name,
        wilayaCode: order.wilaya_code, wilayaName: order.wilaya?.name ?? null,
        status: row.confirmation_status, locked: row.locked || order.delivery_status === "swap",
        duplicate: row.is_duplicate_suspect, attempts: row.confirmation_attempts,
        total: (row.sale_price ?? 0) * row.quantity, age: formatRelativeTime(row.placed_at, locale),
        customerRisk: row.risk,
        callback: row.callback_at
          ? `${t(row.callback_due ? "callbacks.overdue" : "callbacks.scheduled")}: ${formatAlgiersDateTime(row.callback_at)}`
          : undefined,
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.confirmation")}
        subtitle={t("navPurpose.confirmation")}
        related={isAdmin ? [{ href: "/app/sell/shipping", label: t("nav.shipping") }] : undefined}
      >
        <ButtonLink href={presentation.layout === "kanban"
          ? boardShowClosedHref("/app/sell/confirmation", sp)
          : showAll ? "/app/sell/confirmation" : "/app/sell/confirmation?show=all"} variant="outline" size="sm">
          {showAll ? t("orders.showActionable") : t("orders.showClosed")}
        </ButtonLink>
      </PageHeader>
      <OrderTabs active="confirmation" />
      <ViewTabs
        scope="confirmation"
        views={viewsResult.views}
        activeId={active?.id ?? null}
        effective={cfg}
        dirty={dirty}
        presentation={presentation}
        isAdmin={isAdmin}
        loadError={!!viewsResult.error}
        keep={showAll ? "show=all" : ""}
      />
      {invalid ? <InvalidViewNotice rest={rest(sp)} /> : null}
      <QueueFilterBar
        scope="confirmation"
        presentation={presentation}
        isAdmin={isAdmin}
        statusKey="confirmation_status"
        statusLabel={t("fields.confirmation_status")}
        statusOptions={CONFIRMATION_STATUSES.filter((s) => s !== "confirmed" && (showAll || (ACTIONABLE_CONFIRMATION as readonly string[]).includes(s))).map((s) => ({ value: s, label: t(`status.confirmation_status.${s}`) }))}
        q={cfg.q ?? ""}
        status={serializeConfig(cfg).get("confirmation_status") ?? ""}
        viewKeys={FILTER_KEYS.filter((key) => active?.config[key] !== undefined)}
      />
      {(orders ?? []).length >= ROW_LIMIT ? (
        <p role="status" className="text-sm text-muted-foreground">{t("orderViews.limitNotice", { count: ROW_LIMIT })}</p>
      ) : null}
      {ordersError ? <OrderBoardLoadError /> : presentation.layout === "kanban" ? (
        <div className="min-w-0 space-y-3">
          <NewOrdersPill />
          <OrderKanban scope="confirmation" rows={boardRows} presentation={presentation} isAdmin={isAdmin} customerScoreScope={scoreScope}
            empty={<OrderBoardEmpty scope="confirmation" filtered={FILTER_KEYS.some((key) => cfg[key] !== undefined)} isAdmin={isAdmin}
              resetHref={boardResetHref("/app/sell/confirmation", sp, active?.config, presentation)} />} />
        </div>
      ) : <ConfirmationTable rows={rows} scoreScope={scoreScope} />}
    </div>
  );
}
