import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { OrderTabs } from "../order-tabs";
import { ConfirmationRow } from "./row";

export default async function ConfirmationQueuePage() {
  const t = await getTranslations();
  const supabase = await createClient();

  // RLS already scopes confirmation agents to this slice; the explicit
  // filter makes the admin view match the same queue instead of "everything".
  const { data: orders } = await supabase
    .from("orders")
    .select("*, product:products(name)")
    .neq("confirmation_status", "confirmed")
    .order("created_at", { ascending: true });

  const customerIds = [...new Set((orders ?? []).map((o) => o.customer_id).filter((id): id is string => !!id))];
  const { data: stats } = customerIds.length
    ? await supabase.from("customer_stats").select("*").in("id", customerIds)
    : { data: [] };
  const statById = new Map((stats ?? []).map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.tabs.confirmation")} subtitle={t("orders.subtitle")} />
      <OrderTabs active="confirmation" />

      {!orders?.length ? (
        <Empty>{t("orders.none")}</Empty>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <ConfirmationRow key={o.id} order={o} stat={o.customer_id ? (statById.get(o.customer_id) ?? null) : null} />
          ))}
        </div>
      )}
    </div>
  );
}
