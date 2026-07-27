import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { OrderTabs } from "../order-tabs";
import { DeliveryView, type DelivRow } from "./delivery-view";

export default async function DeliveryQueuePage() {
  const t = await getTranslations();
  const supabase = await createClient();

  // Mirrors RLS scoping for delivery agents: confirmed orders, any delivery
  // status — the admin view uses the same explicit filter.
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_phone, quantity, delivery_fee, delivery_type, delivery_status, commune, placed_at, product:products(name), wilaya:wilayas(name)",
    )
    .eq("confirmation_status", "confirmed")
    .order("created_at", { ascending: true });

  const rows: DelivRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    product_name: o.product?.name ?? null,
    quantity: o.quantity,
    delivery_fee: o.delivery_fee,
    wilaya_name: o.wilaya?.name ?? null,
    delivery_type: o.delivery_type,
    delivery_status: o.delivery_status,
    commune: o.commune,
    placed_at: o.placed_at,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.tabs.delivery")} subtitle={t("orders.subtitle")} />
      <OrderTabs active="delivery" />
      <DeliveryView rows={rows} />
    </div>
  );
}
