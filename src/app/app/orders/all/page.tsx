import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import type { Enums } from "@/lib/supabase/database.types";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { OrderTabs } from "../order-tabs";
import { OrdersFilterBar, type Opt } from "../orders-filter-bar";
import { OrdersAllTable, type AllRow } from "./orders-all-table";

const PAGE_SIZE = 25;

// columns the DataTable exposes as sortable → real order-able DB columns
const SORT_COLUMNS: Record<string, string> = {
  order_number: "order_number",
  placed_at: "placed_at",
};

export default async function AllOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : "");
  const page = Math.max(1, Number(get("page")) || 1);

  const t = await getTranslations();
  const supabase = await createClient();

  const [{ data: products }, { data: wilayas }, { data: team }] = await Promise.all([
    supabase.from("products").select("id, name").order("name"),
    supabase.from("wilayas").select("code, name").order("code"),
    supabase.from("profiles").select("user_id, display_name, role").eq("is_active", true),
  ]);
  const agents = (team ?? [])
    .filter((a) => a.role !== "admin")
    .map((a) => ({ id: a.user_id, name: a.display_name ?? a.user_id.slice(0, 8), role: a.role }));
  const nameByUser = new Map((team ?? []).map((a) => [a.user_id, a.display_name ?? a.user_id.slice(0, 8)]));

  let query = supabase
    .from("orders")
    .select(
      "id, order_number, quantity, sale_price, delivery_fee, confirmation_status, delivery_status, source, placed_at, commune, address, wilaya_code, customer_name, customer_phone, is_duplicate_suspect, duplicate_of, assigned_confirmation_agent, assigned_delivery_agent, product:products(name, images), wilaya:wilayas(name)",
      { count: "exact" },
    );

  if (get("confirmation_status"))
    query = query.eq("confirmation_status", get("confirmation_status") as Enums<"confirmation_status">);
  if (get("delivery_status"))
    query = query.eq("delivery_status", get("delivery_status") as Enums<"delivery_status">);
  if (get("product_id")) query = query.eq("product_id", get("product_id"));
  if (get("wilaya_code")) query = query.eq("wilaya_code", Number(get("wilaya_code")));
  if (get("source")) query = query.eq("source", get("source") as Enums<"order_source">);
  if (get("duplicates")) query = query.eq("is_duplicate_suspect", true);
  // .or() takes a raw PostgREST filter string — validate the shape first.
  const agentId = /^[0-9a-f-]{36}$/i.test(get("agent")) ? get("agent") : "";
  if (agentId)
    query = query.or(`assigned_confirmation_agent.eq.${agentId},assigned_delivery_agent.eq.${agentId}`);
  if (get("from")) query = query.gte("placed_at", get("from"));
  if (get("to")) query = query.lte("placed_at", `${get("to")}T23:59:59`);

  const sortCol = SORT_COLUMNS[get("sort")] ?? "created_at";
  const ascending = sortCol === "created_at" ? false : get("dir") !== "desc";

  const from = (page - 1) * PAGE_SIZE;
  const { data: orders, count } = await query
    .order(sortCol, { ascending })
    .range(from, from + PAGE_SIZE - 1);

  // status history for the orders on this page → the detail-sheet timeline
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: events } = orderIds.length
    ? await supabase
        .from("order_status_history")
        .select("id, order_id, stage, to_status, actor, created_at, comment")
        .in("order_id", orderIds)
    : { data: [] };
  const eventsByOrder = new Map<string, AllRow["events"]>();
  for (const e of events ?? []) {
    const list = eventsByOrder.get(e.order_id) ?? [];
    list.push({ id: e.id, stage: e.stage, to_status: e.to_status, actor: e.actor, created_at: e.created_at, comment: e.comment });
    eventsByOrder.set(e.order_id, list);
  }
  const actorIds = [...new Set((events ?? []).map((e) => e.actor).filter((a): a is string => !!a))];
  const actorNames = Object.fromEntries(actorIds.map((id) => [id, nameByUser.get(id) ?? id.slice(0, 8)]));

  const rows: AllRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_number: o.order_number,
    placed_at: o.placed_at,
    customer_name: o.customer_name,
    customer_phone: o.customer_phone,
    product_name: o.product?.name ?? null,
    product_image: o.product?.images?.[0] ?? null,
    quantity: o.quantity,
    sale_price: o.sale_price,
    delivery_fee: o.delivery_fee,
    wilaya_name: o.wilaya?.name ?? null,
    source: o.source,
    confirmation_status: o.confirmation_status,
    delivery_status: o.delivery_status,
    agent_name:
      (o.assigned_confirmation_agent && nameByUser.get(o.assigned_confirmation_agent)) ||
      (o.assigned_delivery_agent && nameByUser.get(o.assigned_delivery_agent)) ||
      null,
    is_duplicate_suspect: o.is_duplicate_suspect ?? false,
    duplicate_of: o.duplicate_of,
    commune: o.commune,
    address: o.address,
    events: eventsByOrder.get(o.id) ?? [],
  }));

  const productOpts: Opt[] = (products ?? []).map((p) => ({ value: p.id, label: p.name }));
  const wilayaOpts: Opt[] = (wilayas ?? []).map((w) => ({ value: String(w.code), label: w.name }));
  const agentOpts: Opt[] = agents.map((a) => ({ value: a.id, label: a.name }));
  const isAdmin = await isCurrentUserAdmin();

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")}>
        <ButtonLink href="/app/orders/new">{t("orders.new")}</ButtonLink>
      </PageHeader>

      <OrderTabs active="all" />

      <OrdersFilterBar products={productOpts} wilayas={wilayaOpts} agents={agentOpts} />

      <OrdersAllTable
        rows={rows}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        showMoney={isAdmin}
        agents={agents}
        actorNames={actorNames}
      />
    </div>
  );
}
