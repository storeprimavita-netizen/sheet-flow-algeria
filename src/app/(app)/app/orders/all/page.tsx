import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin, getProfile } from "@/lib/rbac";
import { getOptionSet } from "@/lib/option-sets";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { swapTargets } from "../_lib/swap-links";
import { OrderTabs } from "../order-tabs";
import { OrdersFilterBar, type Opt } from "../orders-filter-bar";
import { CLEARED, effectiveConfig, isDirty, serializeConfig } from "@/lib/order-views";
import { listViews, resolveView } from "../_lib/views-data";
import { InvalidViewNotice, ViewTabs } from "../view-tabs";
import { applyOrderConfig, orderSort } from "../_lib/order-query";
import { Empty } from "@/components/empty";
import { OrdersAllTable, type AllRow } from "./orders-all-table";

const PAGE_SIZE = 25;

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
      "id, order_seq, order_number, quantity, sale_price, delivery_fee, confirmation_status, delivery_status, source, placed_at, commune, address, wilaya_code, customer_name, customer_phone, is_duplicate_suspect, duplicate_of, swapped_to_order_id, assigned_confirmation_agent, assigned_delivery_agent, product:products(name, images), wilaya:wilayas(name)",
      { count: "exact" },
    );

  const viewsResult = await listViews("all");
  const { active, invalid } = resolveView(viewsResult.views, sp.view);
  const cfg = effectiveConfig(active?.config ?? null, sp);
  query = applyOrderConfig(query, cfg);
  const q = cfg.q ?? "";
  const { column: sortCol, ascending } = orderSort(cfg);

  const from = (page - 1) * PAGE_SIZE;
  const { data: orders, count, error: ordersError } = await query
    .order(sortCol, { ascending })
    .range(from, from + PAGE_SIZE - 1);

  if (ordersError) {
    console.error("orders/all", ordersError.message);
    const retry = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    return (
      <div className="space-y-6">
        <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")} />
        <OrderTabs active="all" />
        <Empty>
          <p className="font-medium text-foreground">{t("orders.loadError")}</p>
          <div className="mt-4 flex justify-center">
            <ButtonLink href={`/app/orders/all?${retry.toString()}`} size="sm">
              {t("orders.retry")}
            </ButtonLink>
          </div>
        </Empty>
      </div>
    );
  }

  // status history for the orders on this page → the detail-sheet timeline
  const orderIds = (orders ?? []).map((o) => o.id);
  const { workspaceId } = (await getProfile())!;
  const [{ data: events }, { data: orderTags }, tagOptions] = await Promise.all([
    orderIds.length
      ? supabase
          .from("order_status_history")
          .select("id, order_id, stage, to_status, actor, created_at, comment")
          .in("order_id", orderIds)
      : Promise.resolve({ data: [] }),
    orderIds.length
      ? supabase.from("order_tags").select("order_id, option_id").in("order_id", orderIds)
      : Promise.resolve({ data: [] }),
    getOptionSet(workspaceId, "order_tag"),
  ]);
  const tagById = new Map(tagOptions.map((o) => [o.id, o]));
  const tagsByOrder = new Map<string, { id: string; label: string; token: (typeof tagOptions)[number]["color_token"] }[]>();
  for (const row of orderTags ?? []) {
    const opt = tagById.get(row.option_id);
    if (!opt) continue;
    const list = tagsByOrder.get(row.order_id) ?? [];
    list.push({ id: opt.id, label: opt.label, token: opt.color_token });
    tagsByOrder.set(row.order_id, list);
  }
  const eventsByOrder = new Map<string, AllRow["events"]>();
  for (const e of events ?? []) {
    const list = eventsByOrder.get(e.order_id) ?? [];
    list.push({ id: e.id, stage: e.stage, to_status: e.to_status, actor: e.actor, created_at: e.created_at, comment: e.comment });
    eventsByOrder.set(e.order_id, list);
  }
  const actorIds = [...new Set((events ?? []).map((e) => e.actor).filter((a): a is string => !!a))];
  const actorNames = Object.fromEntries(actorIds.map((id) => [id, nameByUser.get(id) ?? id.slice(0, 8)]));

  const swaps = await swapTargets(supabase, orders ?? []);
  const rows: AllRow[] = (orders ?? []).map((o) => ({
    id: o.id,
    order_seq: o.order_seq,
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
    swapped_to: swaps.get(o.id) ?? null,
    commune: o.commune,
    address: o.address,
    tags: tagsByOrder.get(o.id) ?? [],
    events: eventsByOrder.get(o.id) ?? [],
  }));

  const productOpts: Opt[] = (products ?? []).map((p) => ({ value: p.id, label: p.name }));
  const wilayaOpts: Opt[] = (wilayas ?? []).map((w) => ({ value: String(w.code), label: w.name }));
  const agentOpts: Opt[] = agents.map((a) => ({ value: a.id, label: a.name }));
  const isAdmin = await isCurrentUserAdmin();
  const restParams = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "view" ? [[k, v]] : [])));
  const withoutQ = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "q" && k !== "page" ? [[k, v]] : [])));
  if (active?.config.q) withoutQ.set("q", CLEARED); // the view's own q must be cleared too
  const clearQueryHref = `/app/orders/all${withoutQ.size ? `?${withoutQ.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} subtitle={t("orders.subtitle")}>
        <ButtonLink href="/app/orders/new">{t("orders.new")}</ButtonLink>
      </PageHeader>

      <OrderTabs active="all" />

      <ViewTabs
        scope="all"
        views={viewsResult.views}
        activeId={active?.id ?? null}
        effective={cfg}
        dirty={active ? isDirty(active.config, sp) : false}
        isAdmin={isAdmin}
        loadError={!!viewsResult.error}
        keep=""
      />
      {invalid ? <InvalidViewNotice rest={restParams.toString()} /> : null}

      <OrdersFilterBar
        products={productOpts}
        wilayas={wilayaOpts}
        agents={agentOpts}
        values={Object.fromEntries(serializeConfig(cfg))}
        viewKeys={Object.keys(active?.config ?? {})}
      />

      <OrdersAllTable
        rows={rows}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        showMoney={isAdmin}
        agents={agents}
        actorNames={actorNames}
        query={q}
        clearQueryHref={clearQueryHref}
      />
    </div>
  );
}
