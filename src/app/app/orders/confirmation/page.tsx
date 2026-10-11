import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { ACTIONABLE_CONFIRMATION } from "@/lib/statuses";
import { OrderTabs } from "../order-tabs";
import { ConfirmationTable, type ConfRow } from "./confirmation-table";

export default async function ConfirmationQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const showAll = (await searchParams).show === "all";
  const t = await getTranslations();
  const supabase = await createClient();

  // Default = actionable only (same list as the sidebar badge); "show closed"
  // adds cancelled. Confirmed orders live in the delivery queue.
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, customer_id, customer_name, customer_phone, quantity, sale_price, confirmation_status, confirmation_comment, confirmation_attempts, commune, placed_at, is_duplicate_suspect, duplicate_of, product:products(name)",
    )
    .order("created_at", { ascending: true });
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
          .select("id, order_number, customer_id, delivery_status, placed_at")
          .in("customer_id", customerIds)
          .order("placed_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const statById = new Map((stats ?? []).map((s) => [s.id, s]));
  const historyByCustomer = new Map<string, ConfRow["recent"]>();
  for (const h of history ?? []) {
    if (!h.customer_id) continue;
    const list = historyByCustomer.get(h.customer_id) ?? [];
    list.push({ id: h.id, order_number: h.order_number, delivery_status: h.delivery_status, placed_at: h.placed_at });
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
      order_number: o.order_number,
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
      delivery_rate:
        total > 0 ? `${Math.round(((stat?.delivered_orders ?? 0) / total) * 100)}% (${stat?.delivered_orders ?? 0}/${total})` : "—",
      recent,
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
      <ConfirmationTable rows={rows} />
    </div>
  );
}
