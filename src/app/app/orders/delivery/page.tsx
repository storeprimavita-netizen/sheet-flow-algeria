import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { ACTIONABLE_DELIVERY } from "@/lib/statuses";
import { swapTargets } from "../_lib/swap-links";
import { OrderTabs } from "../order-tabs";
import { DeliveryView, type DelivRow } from "./delivery-view";

export default async function DeliveryQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const showAll = (await searchParams).show === "all";
  const t = await getTranslations();
  const supabase = await createClient();

  // Confirmed orders still in flight (same list as the sidebar badge);
  // "show closed" adds delivered / returned / cancelled / swapped.
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, quantity, sale_price, delivery_fee, delivery_type, delivery_status, swapped_to_order_id, commune, placed_at, product:products(name), wilaya:wilayas(name), zr:zr_shipments(tracking_number, state)",
    )
    .eq("confirmation_status", "confirmed")
    .order("created_at", { ascending: true });
  if (!showAll) query = query.in("delivery_status", ACTIONABLE_DELIVERY);
  const { data: orders } = await query;

  const swaps = await swapTargets(supabase, orders ?? []);
  const rows: DelivRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
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
      <DeliveryView rows={rows} isAdmin={await isCurrentUserAdmin()} />
    </div>
  );
}
