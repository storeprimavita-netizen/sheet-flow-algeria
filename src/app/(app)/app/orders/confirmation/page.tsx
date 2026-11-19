import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { customerDeliveryRate } from "@/lib/customers";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { ACTIONABLE_CONFIRMATION } from "@/lib/statuses";
import { OrderTabs } from "../order-tabs";
import { effectiveConfig, isDirty, serializeConfig } from "@/lib/order-views";
import { applyOrderConfig, orderSort, ROW_LIMIT } from "../_lib/order-query";
import { listViews, resolveView } from "../_lib/views-data";
import { InvalidViewNotice, ViewTabs } from "../view-tabs";
import { QueueFilterBar } from "../queue-filter-bar";
import { CONFIRMATION_STATUSES } from "@/lib/enums";
import { ConfirmationTable, type ConfRow } from "./confirmation-table";

const rest = (sp: Record<string, string | string[] | undefined>) =>
  new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "view" ? [[k, v]] : []))).toString();

export default async function ConfirmationQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const showAll = sp.show === "all";
  const t = await getTranslations();
  const supabase = await createClient();
  const isAdmin = await isCurrentUserAdmin();

  // Default = actionable only (same list as the sidebar badge); "show closed"
  // adds cancelled. Confirmed orders live in the delivery queue.
  let query = supabase
    .from("orders")
    .select(
      "id, order_seq, customer_id, customer_name, customer_phone, quantity, sale_price, confirmation_status, confirmation_comment, confirmation_attempts, commune, placed_at, is_duplicate_suspect, duplicate_of, delivery_status, product:products(name), zr:zr_shipments(order_id)",
    );
  const viewsResult = await listViews("confirmation");
  const { active, invalid } = resolveView(viewsResult.views, sp.view);
  const cfg = effectiveConfig(active?.config ?? null, sp);
  query = applyOrderConfig(query, cfg);
  // oldest first unless the view sorts; the page's own filter below is applied last, so a view can only narrow
  const sort = cfg.sort ? orderSort(cfg) : { column: "created_at", ascending: true };
  query = query.order(sort.column, { ascending: sort.ascending });
  query = showAll ? query.neq("confirmation_status", "confirmed") : query.in("confirmation_status", ACTIONABLE_CONFIRMATION);
  const { data: orders } = await query;

  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id).filter((id): id is string => !!id))];

  const [{ data: stats }, { data: history }] = await Promise.all([
    customerIds.length
      ? supabase.from("customer_stats").select("*").in("id", customerIds)
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
    const returned = stat?.returned_orders ?? 0;
    const cancelled = stat?.cancelled_orders ?? 0;
    const total = stat?.total_orders ?? 0;
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
      risk_score: stat?.risk_score ?? 0,
      risk_reason: t("orders.riskReason", { total, returned, cancelled }),
      delivery_rate: customerDeliveryRate(stat)?.label ?? "—",
      recent,
      // shipped orders: agents may not log attempts (DB already blocks writes, 00025)
      locked: !isAdmin && (o.delivery_status !== "wait_for_deposit" || (Array.isArray(o.zr) ? o.zr.length > 0 : !!o.zr)),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.tabs.confirmation")} subtitle={t("orders.subtitle")}>
        <ButtonLink href={showAll ? "/app/orders/confirmation" : "/app/orders/confirmation?show=all"} variant="outline" size="sm">
          {showAll ? t("orders.showActionable") : t("orders.showClosed")}
        </ButtonLink>
      </PageHeader>
      <OrderTabs active="confirmation" />
      <ViewTabs
        scope="confirmation"
        views={viewsResult.views}
        activeId={active?.id ?? null}
        effective={cfg}
        dirty={active ? isDirty(active.config, sp) : false}
        isAdmin={isAdmin}
        loadError={!!viewsResult.error}
        keep={showAll ? "show=all" : ""}
      />
      {invalid ? <InvalidViewNotice rest={rest(sp)} /> : null}
      <QueueFilterBar
        statusKey="confirmation_status"
        statusLabel={t("fields.confirmation_status")}
        statusOptions={CONFIRMATION_STATUSES.filter((s) => s !== "confirmed" && (showAll || (ACTIONABLE_CONFIRMATION as readonly string[]).includes(s))).map((s) => ({ value: s, label: t(`status.confirmation_status.${s}`) }))}
        q={cfg.q ?? ""}
        status={serializeConfig(cfg).get("confirmation_status") ?? ""}
        viewKeys={Object.keys(active?.config ?? {})}
      />
      {(orders ?? []).length >= ROW_LIMIT ? (
        <p role="status" className="text-sm text-muted-foreground">{t("orderViews.limitNotice", { count: ROW_LIMIT })}</p>
      ) : null}
      <ConfirmationTable rows={rows} />
    </div>
  );
}
