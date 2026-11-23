import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin, requireProfile } from "@/lib/rbac";
import type { Enums } from "@/lib/supabase/database.types";
import { getOptionSet } from "@/lib/option-sets";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { swapTargets } from "../_lib/swap-links";
import { OrderTabs } from "../order-tabs";
import { DRILL_FILTER_KEYS, parseDrillFilters } from "../_lib/drill-filters";
import { OrdersFilterBar, type Opt } from "../orders-filter-bar";
import { CLEARED, effectiveConfig, FILTER_KEYS, isDirty, presentationDirty, viewPresentation, serializeConfig } from "@/lib/order-views";
import { listViews, resolveView } from "../_lib/views-data";
import { InvalidViewNotice, ViewTabs } from "../view-tabs";
import { applyOrderConfig, orderSort } from "../_lib/order-query";
import { Empty } from "@/components/empty";
import { DrillBanner } from "@/components/stats/drill-banner";
import { COMMUNE_UNKNOWN_PARAM, communeBannerLabel, isRealIsoDate, MAX_COMMUNE_KEY, OUTCOME_DRILLS } from "@/lib/query-string";
import { ORDER_SOURCES } from "@/lib/enums";
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
  const members = (team ?? []).map((a) => ({ id: a.user_id, name: a.display_name ?? a.user_id.slice(0, 8), role: a.role }));
  const agents = members.filter((a) => a.role !== "admin");
  const nameByUser = new Map((team ?? []).map((a) => [a.user_id, a.display_name ?? a.user_id.slice(0, 8)]));

  // Drill mode (from /app/statistics): the exact orders behind one SQL count. The id list comes
  // from kpi_drill_orders (same set, commune key and predicate as the table), one page at a time.
  const drillMetric = (["received", "confirmed", "delivered", "return", "shipped", ...OUTCOME_DRILLS] as string[]).find((m) => m === get("drill")) ?? null;
  const weekday = /^[1-7]$/.test(get("weekday")) ? get("weekday") : "";
  const hour = /^([0-9]|1\d|2[0-3])$/.test(get("hour")) ? get("hour") : "";
  const communeKey = get("commune_key");
  // display only (original spelling for the banner); the key stays the filter
  const communeLabel = get("commune_label").slice(0, MAX_COMMUNE_KEY);
  // Statistics filters on this page: `category` (option uuid) and `conf_agent` (confirmation agent
  // only; `agent` keeps its confirmation-OR-delivery meaning). Same text comparison as kpi_order_set.
  const { filters: drillChecked, dropped: droppedDrill } = parseDrillFilters(get, DRILL_FILTER_KEYS.filter((k) => Array.isArray(sp[k])));
  const { category, confAgent, deliveryType } = drillChecked;
  const drillFilters: Record<string, string> = {};
  if (category) drillFilters.category = category;
  if (confAgent) drillFilters.agent = confAgent;
  if ((ORDER_SOURCES as readonly string[]).includes(get("source"))) drillFilters.source = get("source");
  if (weekday) drillFilters.weekday = weekday;
  if (hour) drillFilters.hour = hour;
  const communeUnknown = get(COMMUNE_UNKNOWN_PARAM) === "1";
  // a reversed range is swapped, as Dashboard and Statistics do (the range check would raise)
  const rawFrom = isRealIsoDate(get("from")) ? get("from") : undefined;
  const rawTo = isRealIsoDate(get("to")) ? get("to") : undefined;
  const [drillFrom, drillTo] = rawFrom && rawTo && rawFrom > rawTo ? [rawTo, rawFrom] : [rawFrom, rawTo];
  let drillIds: string[] | null = null;
  let drillTotal = 0;
  let drillFailed = false;
  if (drillMetric && communeKey.length > MAX_COMMUNE_KEY) {
    // no commune key can be this long: nothing matches (never cut a key to a different one)
    drillIds = [];
  } else if (drillMetric) {
    const { data: drill, error: drillError } = await supabase.rpc("kpi_drill_orders", {
      p_metric: drillMetric,
      p_from: drillFrom,
      p_to: drillTo,
      p_product: /^[0-9a-f-]{36}$/i.test(get("product_id")) ? [get("product_id")] : undefined,
      p_wilaya: /^\d{1,2}$/.test(get("wilaya_code")) ? Number(get("wilaya_code")) : undefined,
      p_commune_key: communeKey && !communeUnknown ? communeKey : undefined,
      p_unknown: communeUnknown,
      p_delivery_type: deliveryType || undefined,
      p_offset: (page - 1) * PAGE_SIZE,
      p_limit: PAGE_SIZE,
      p_filters: Object.keys(drillFilters).length ? drillFilters : undefined,
    });
    if (drillError) {
      console.error("orders/all drill", drillError.message);
      drillFailed = true;
    }
    drillIds = (drill ?? []).map((r) => r.id);
    drillTotal = Number(drill?.[0]?.total ?? 0);
  }

  let query = supabase
    .from("orders")
    .select(
      "id, order_seq, order_number, quantity, sale_price, delivery_fee, confirmation_status, delivery_status, source, placed_at, commune, address, wilaya_code, customer_name, customer_phone, is_duplicate_suspect, duplicate_of, swapped_to_order_id, assigned_confirmation_agent, assigned_delivery_agent, product:products(name, images), wilaya:wilayas(name)",
      { count: "exact" },
    );

  const isAdmin = await isCurrentUserAdmin();
  const viewsResult = await listViews("all");
  const { active, invalid } = resolveView(viewsResult.views, sp.view);
  const cfg = effectiveConfig(active?.config ?? null, sp);
  const presentation = viewPresentation("all", isAdmin, active, sp);
  const dirty = !!active && (isDirty(active.config, sp) || presentationDirty(viewPresentation("all", isAdmin, active), presentation));
  const q = cfg.q ?? "";
  if (drillIds) {
    // the id page is the whole filter in drill mode
    query = query.in("id", drillIds.length ? drillIds : ["00000000-0000-0000-0000-000000000000"]);
  } else {
    query = applyOrderConfig(query, cfg);
    // statistics-only filters (URL only, never stored in a view)
    if (deliveryType) query = query.eq("delivery_type", deliveryType as Enums<"delivery_type">);
    if (confAgent) query = query.eq("assigned_confirmation_agent", confAgent);
    if (category) {
      const { data: inCategory } = await supabase.from("products").select("id").eq("category_option_id", category);
      query = query.in("product_id", (inCategory ?? []).map((p) => p.id).concat("00000000-0000-0000-0000-000000000000"));
    }
  }
  const { column: sortCol, ascending } = orderSort(cfg);

  const from = drillIds ? 0 : (page - 1) * PAGE_SIZE;
  // drill mode: the id page already has its order (re-ranked below), so no DB sort
  const { data: fetched, count: fetchedCount, error: ordersError } = await (drillIds ? query : query.order(sortCol, { ascending }))
    .range(from, from + PAGE_SIZE - 1);
  const rank = new Map((drillIds ?? []).map((id, i) => [id, i]));
  const orders = drillIds ? [...(fetched ?? [])].sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)) : fetched;
  const count = drillIds ? drillTotal : fetchedCount;

  if (ordersError || drillFailed) {
    if (ordersError) console.error("orders/all", ordersError.message);
    const retry = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    return (
      <div className="space-y-6">
        <PageHeader title={t("nav.all")} subtitle={t("orders.subtitle")} />
        <OrderTabs active="all" />
        <Empty>
          <p className="font-medium text-foreground">{t("orders.loadError")}</p>
          <div className="mt-4 flex justify-center">
            <ButtonLink href={`/app/sell/orders?${retry.toString()}`} size="sm">
              {t("orders.retry")}
            </ButtonLink>
          </div>
        </Empty>
      </div>
    );
  }

  // status history for the orders on this page → the detail-sheet timeline
  const orderIds = (orders ?? []).map((o) => o.id);
  const { workspaceId } = await requireProfile();
  const [{ data: events }, { data: orderTags }, tagOptions, categoryOptions] = await Promise.all([
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
    getOptionSet(workspaceId, "product_category"),
  ]);
  const tagById = new Map(tagOptions.map((o) => [o.id, o]));
  const tagsByOrder = new Map<string, { id: string; label: string; emoji: string | null; token: (typeof tagOptions)[number]["color_token"] }[]>();
  for (const row of orderTags ?? []) {
    const opt = tagById.get(row.option_id);
    if (!opt) continue;
    const list = tagsByOrder.get(row.order_id) ?? [];
    list.push({ id: opt.id, label: opt.label, emoji: opt.emoji, token: opt.color_token });
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
  // every workspace member (admins included) so a conf_agent chip always has a name
  const agentOpts: Opt[] = members.map((a) => ({ value: a.id, label: a.name }));
  const categoryOpts: Opt[] = categoryOptions.map((o) => ({ value: o.id, label: o.label }));
  const restParams = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "view" ? [[k, v]] : [])));
  const withoutQ = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" && k !== "q" && k !== "page" ? [[k, v]] : [])));
  if (active?.config.q) withoutQ.set("q", CLEARED); // the view's own q must be cleared too
  const clearQueryHref = `/app/sell/orders${withoutQ.size ? `?${withoutQ.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.all")} subtitle={t("orders.subtitle")}>
        <ButtonLink href="/app/sell/orders/new">{t("orders.new")}</ButtonLink>
      </PageHeader>

      <OrderTabs active="all" />

      <ViewTabs
        scope="all"
        views={viewsResult.views}
        activeId={active?.id ?? null}
        effective={cfg}
        dirty={dirty}
        presentation={presentation}
        isAdmin={isAdmin}
        loadError={!!viewsResult.error}
        keep=""
      />
      {invalid ? <InvalidViewNotice rest={restParams.toString()} /> : null}

      {drillMetric ? (
        <DrillBanner
          metric={t(`orders.drill.${drillMetric}`)}
          parts={[
            wilayaOpts.find((w) => w.value === get("wilaya_code"))?.label ?? get("wilaya_code"),
            deliveryType === "home" || deliveryType === "stopdesk" ? t(`statistics.${deliveryType}`) : "",
            weekday ? t(`statistics.charts.weekday.${weekday}`) : "",
            hour ? t("orders.drill.hour", { n: hour }) : "",
            communeUnknown ? t("statistics.unknownCommune") : communeKey ? (communeLabel ? communeBannerLabel(communeKey, communeLabel) : communeKey) : "",
          ]}
          clearLabel={t("orders.drill.clear")}
        />
      ) : null}

      <OrdersFilterBar
        presentation={presentation}
        isAdmin={isAdmin}
        products={productOpts}
        wilayas={wilayaOpts}
        agents={agentOpts}
        values={Object.fromEntries(serializeConfig(cfg))}
        viewKeys={FILTER_KEYS.filter((key) => active?.config[key] !== undefined)}
        categories={categoryOpts}
        drill={drillChecked}
        dropped={droppedDrill}
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
