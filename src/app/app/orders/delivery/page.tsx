import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { OrderTabs } from "../order-tabs";
import { DeliveryRow } from "./row";

export default async function DeliveryQueuePage() {
  const t = await getTranslations();
  const supabase = await createClient();

  // Mirrors the RLS scoping for delivery agents: confirmed orders, any
  // delivery_status — the admin view uses the same explicit filter.
  const { data: orders } = await supabase
    .from("orders")
    .select("*, product:products(name), wilaya:wilayas(name)")
    .eq("confirmation_status", "confirmed")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.tabs.delivery")} subtitle={t("orders.subtitle")} />
      <OrderTabs active="delivery" />

      {!orders?.length ? (
        <Empty>{t("orders.none")}</Empty>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <DeliveryRow key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
