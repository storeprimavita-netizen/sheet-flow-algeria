import { getLocale, getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { formatRelativeTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { ACTIONABLE_DELIVERY } from "@/lib/statuses";
import { swapTargets } from "../orders/_lib/swap-links";
import { OrderTabs } from "../orders/order-tabs";
import { effectiveConfig, FILTER_KEYS, isDirty, presentationDirty, viewPresentation } from "@/lib/order-views";
import { applyOrderConfig, orderSort, ROW_LIMIT } from "../orders/_lib/order-query";
import { listViews, resolveView } from "../orders/_lib/views-data";
import { InvalidViewNotice, ViewTabs } from "../orders/view-tabs";
import { QueueFilterBar } from "../orders/queue-filter-bar";
import { DELIVERY_STATUSES } from "@/lib/enums";
import { DeliveryTable, type DelivRow } from "./delivery-table";
import { OrderBoardLoadError, OrderKanban } from "../orders/order-kanban";
import { OrderBoardEmpty } from "../orders/order-board-empty";
import { boardResetHref, boardShowClosedHref, clearSearchHref, type KanbanRow } from "../orders/_lib/kanban";

export default async function DeliveryQueuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const showAll = sp.show === "all";
  const t = await getTranslations();
  const supabase = await createClient();
  const isAdmin = await isCurrentUserAdmin();
  const rest = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "view" ? [[k, v]] : []))).toString();

  // Confirmed orders still in flight (same list as the sidebar badge);
  // "show closed" adds delivered / returned / cancelled / swapped.
  let query = supabase
    .from("orders")
    .select(
      "id, order_seq, customer_name, customer_phone, quantity, sale_price, delivery_fee, delivery_type, delivery_status, swapped_to_order_id, commune, placed_at, product_id, wilaya_code, confirmation_attempts, product:products(name), wilaya:wilayas(name), zr:zr_shipments(tracking_number, state)",
    );
  const viewsResult = await listViews("shipping");
  const { active, invalid } = resolveView(viewsResult.views, sp.view, "shipping");
  const cfg = effectiveConfig(active?.config ?? null, sp);
  const presentation = viewPresentation("shipping", isAdmin, active, sp);
  const dirty = !!active && (isDirty(active.config, sp) || presentationDirty(viewPresentation("shipping", isAdmin, active), presentation));
  query = applyOrderConfig(query, cfg);
  const search = cfg.q ? { q: cfg.q, clearHref: clearSearchHref("/app/sell/shipping", sp, active?.config) } : undefined;
  const sort = cfg.sort ? orderSort(cfg) : { column: "created_at", ascending: true };
  // fixed page filter applied last: whatever the view says, only confirmed orders are listed here
  query = query.order(sort.column, { ascending: sort.ascending }).eq("confirmation_status", "confirmed");
  if (!showAll) query = query.in("delivery_status", ACTIONABLE_DELIVERY);
  const { data: orders, error: ordersError } = await query;

  const swaps = await swapTargets(supabase, orders ?? []);
  const rows: DelivRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_seq: o.order_seq,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    product_name: o.product?.name ?? null,
    quantity: o.quantity,
    delivery_fee: o.delivery_fee,
    // COD: the customer pays the courier sale·qty + delivery fee.
    to_collect: (o.sale_price ?? 0) * o.quantity + (o.delivery_fee ?? 0),
    tracking_number: o.zr?.tracking_number ?? null,
    zr_state: o.zr?.state ?? null,
    wilaya_name: o.wilaya?.name ?? null,
    delivery_type: o.delivery_type,
    delivery_status: o.delivery_status,
    commune: o.commune,
    swapped_to: swaps.get(o.id) ?? null,
    placed_at: o.placed_at,
  }));

  const boardRows: KanbanRow[] = [];
  if (presentation.layout === "kanban" && orders) {
    const locale = await getLocale();
    for (const [index, order] of orders.entries()) {
      const row = rows[index];
      boardRows.push({
        id: row.id, orderSeq: row.order_seq, customerName: row.customer_name, customerPhone: row.customer_phone,
        productId: order.product_id, productName: row.product_name,
        wilayaCode: order.wilaya_code, wilayaName: row.wilaya_name, status: row.delivery_status,
        swappedTo: row.swapped_to, attempts: isAdmin ? order.confirmation_attempts ?? 0 : undefined,
        total: row.to_collect, age: formatRelativeTime(row.placed_at, locale),
      });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.shipping")}
        subtitle={t("navPurpose.shipping")}
        related={isAdmin ? [{ href: "/app/sell/confirmation", label: t("nav.confirmation") }] : undefined}
      >
        <ButtonLink href={presentation.layout === "kanban"
          ? boardShowClosedHref("/app/sell/shipping", sp)
          : showAll ? "/app/sell/shipping" : "/app/sell/shipping?show=all"} variant="outline" size="sm">
          {showAll ? t("orders.showActionable") : t("orders.showClosed")}
        </ButtonLink>
      </PageHeader>
      <OrderTabs active="delivery" />
      <ViewTabs
        scope="shipping"
        views={viewsResult.views}
        activeId={active?.id ?? null}
        effective={cfg}
        dirty={dirty}
        presentation={presentation}
        isAdmin={isAdmin}
        loadError={!!viewsResult.error}
        keep={showAll ? "show=all" : ""}
      />
      {invalid ? <InvalidViewNotice rest={rest} /> : null}
      <QueueFilterBar
        scope="shipping"
        presentation={presentation}
        isAdmin={isAdmin}
        statusKey="delivery_status"
        statusLabel={t("fields.delivery_status")}
        statusOptions={DELIVERY_STATUSES.filter((s) => showAll || (ACTIONABLE_DELIVERY as readonly string[]).includes(s)).map((s) => ({ value: s, label: t(`status.delivery_status.${s}`) }))}
        q={cfg.q ?? ""}
        status={cfg.delivery_status ?? ""}
        viewKeys={FILTER_KEYS.filter((key) => active?.config[key] !== undefined)}
      />
      {(orders ?? []).length >= ROW_LIMIT ? (
        <p role="status" className="text-sm text-muted-foreground">{t("orderViews.limitNotice", { count: ROW_LIMIT })}</p>
      ) : null}
      {ordersError ? <OrderBoardLoadError /> : presentation.layout === "kanban" ? (
        <OrderKanban scope="shipping" rows={boardRows} presentation={presentation} isAdmin={isAdmin}
          empty={<OrderBoardEmpty scope="shipping" search={search} filtered={FILTER_KEYS.some((key) => cfg[key] !== undefined)} isAdmin={isAdmin}
            resetHref={boardResetHref("/app/sell/shipping", sp, active?.config, presentation)} />} />
      ) : <DeliveryTable rows={rows} isAdmin={isAdmin} search={search} />}
    </div>
  );
}
