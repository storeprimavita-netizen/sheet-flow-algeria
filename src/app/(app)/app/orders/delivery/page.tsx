import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { ACTIONABLE_DELIVERY } from "@/lib/statuses";
import { swapTargets } from "../_lib/swap-links";
import { OrderTabs } from "../order-tabs";
import { effectiveConfig, isDirty } from "@/lib/order-views";
import { applyOrderConfig, orderSort, ROW_LIMIT } from "../_lib/order-query";
import { listViews, resolveView } from "../_lib/views-data";
import { InvalidViewNotice, ViewTabs } from "../view-tabs";
import { QueueFilterBar } from "../queue-filter-bar";
import { DELIVERY_STATUSES } from "@/lib/enums";
import { DeliveryView, type DelivRow } from "./delivery-view";

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
      "id, order_seq, customer_name, customer_phone, quantity, sale_price, delivery_fee, delivery_type, delivery_status, swapped_to_order_id, commune, placed_at, product:products(name), wilaya:wilayas(name), zr:zr_shipments(tracking_number, state)",
    );
  const viewsResult = await listViews("shipping");
  const { active, invalid } = resolveView(viewsResult.views, sp.view);
  const cfg = effectiveConfig(active?.config ?? null, sp);
  query = applyOrderConfig(query, cfg);
  const sort = cfg.sort ? orderSort(cfg) : { column: "created_at", ascending: true };
  // fixed page filter applied last: whatever the view says, only confirmed orders are listed here
  query = query.order(sort.column, { ascending: sort.ascending }).eq("confirmation_status", "confirmed");
  if (!showAll) query = query.in("delivery_status", ACTIONABLE_DELIVERY);
  const { data: orders } = await query;

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

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.tabs.delivery")} subtitle={t("orders.subtitle")}>
        <ButtonLink href={showAll ? "/app/orders/delivery" : "/app/orders/delivery?show=all"} variant="outline" size="sm">
          {showAll ? t("orders.showActionable") : t("orders.showClosed")}
        </ButtonLink>
      </PageHeader>
      <OrderTabs active="delivery" />
      <ViewTabs
        scope="shipping"
        views={viewsResult.views}
        activeId={active?.id ?? null}
        effective={cfg}
        dirty={active ? isDirty(active.config, sp) : false}
        isAdmin={isAdmin}
        loadError={!!viewsResult.error}
        keep={showAll ? "show=all" : ""}
      />
      {invalid ? <InvalidViewNotice rest={rest} /> : null}
      <QueueFilterBar
        statusKey="delivery_status"
        statusLabel={t("fields.delivery_status")}
        statusOptions={DELIVERY_STATUSES.map((s) => ({ value: s, label: t(`status.delivery_status.${s}`) }))}
        q={cfg.q ?? ""}
        status={cfg.delivery_status ?? ""}
        viewKeys={Object.keys(active?.config ?? {})}
      />
      {(orders ?? []).length >= ROW_LIMIT ? (
        <p role="status" className="text-sm text-muted-foreground">{t("orderViews.limitNotice", { count: ROW_LIMIT })}</p>
      ) : null}
      <DeliveryView rows={rows} isAdmin={isAdmin} />
    </div>
  );
}
