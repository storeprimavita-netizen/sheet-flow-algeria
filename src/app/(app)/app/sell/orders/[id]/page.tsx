import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isCurrentUserAdmin, requireProfile } from "@/lib/rbac";
import { formatCurrency, formatDateTime, formatOrderNo, ltr } from "@/lib/format";
import { getOptionSet } from "@/lib/option-sets";

import { PageHeader } from "@/components/page-header";
import { PhoneLinks } from "@/components/phone-links";
import { Empty } from "@/components/empty";
import { ButtonLink } from "@/components/button-link";
import { orderHome, purposeKey } from "@/components/nav-model";
import { DeleteButton } from "@/components/delete-button";
import { OrderWorkflow } from "../order-workflow";
import { AssignmentCard } from "./assignment-card";
import { ZRShipmentCard } from "./zr-shipment-card";
import { zrSendState } from "@/lib/integrations/zr-sendable";
import { OrderTaxonomyCard } from "./order-taxonomy-card";
import { SwapBadge } from "@/components/swap-badge";
import { SwapCard } from "./swap-card";
import { CrumbRecord } from "@/components/breadcrumbs";
import { VariantCard } from "./variant-card";
import { Meta, showsSizeCell, SizeMeta, WilayaValue } from "./order-meta";
import { loadProductVariants } from "@/lib/catalog/variants-data";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { workspaceId } = await requireProfile(); // before queries: an RLS-empty read must not become a 404
  const t = await getTranslations();
  const role = await getCurrentUserRole();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, product:products(name, sku), customer:customers(name, phone, commune), wilaya:wilayas(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    const home = orderHome(role);
    return (
      <div className="space-y-6">
        <PageHeader title={t(`nav.${home.key}`)} subtitle={t(purposeKey(home))} />
        <Empty>{t("orders.notFound")}</Empty>
        <ButtonLink href={home.href} variant="outline">
          {t("orders.backToQueue", { page: t(`nav.${home.key}`) })}
        </ButtonLink>
      </div>
    );
  }

  const { data: events } = await supabase
    .from("order_status_history")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  // `actor` has no FK (webhooks may write null) — resolve names separately.
  const actorIds = [...new Set((events ?? []).map((e) => e.actor).filter((a): a is string => !!a))];
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("user_id, display_name").in("user_id", actorIds)
    : { data: [] };
  const actorNames = Object.fromEntries(
    (actors ?? []).map((a) => [a.user_id, a.display_name ?? a.user_id.slice(0, 8)]),
  );

  const isAdmin = await isCurrentUserAdmin();
  const [tags, reasons, { data: orderTags }] = await Promise.all([
    getOptionSet(workspaceId, "order_tag"),
    getOptionSet(workspaceId, "cancellation_reason"),
    supabase.from("order_tags").select("option_id").eq("order_id", id),
  ]);

  // admin: agent rosters for the assignment card
  const confirmationAgents: { id: string; email: string }[] = [];
  let zrShipment: { trackingNumber: string | null; state: string | null; stateUpdatedAt: string | null } | null = null;
  let swapData: {
    swappedTo: { id: string; orderSeq: number } | null;
    swappedFrom: { id: string; orderSeq: number } | null;
    wilayas: { code: number; name: string }[];
  } = { swappedTo: null, swappedFrom: null, wilayas: [] };
  // the forward swap link is visible to every role (badge); the rest of the swap data is admin-only
  if (order.swapped_to_order_id) {
    const { data: b } = await supabase
      .from("orders")
      .select("id, order_seq")
      .eq("id", order.swapped_to_order_id)
      .maybeSingle();
    if (b) swapData.swappedTo = { id: b.id, orderSeq: b.order_seq };
  }
  // agents can't see the ZR card but still need to know the order was pushed (locks cancel-reason)
  const { data: zrExists } = await supabase.from("zr_shipments").select("order_id").eq("order_id", order.id).maybeSingle();
  // admin escape hatch: a stop-desk order whose wilaya became home-only can be switched to home
  const sendState = zrSendState(order);
  let canSwitchToHome = false;
  if (isAdmin && !zrExists && order.delivery_type === "stopdesk" && order.wilaya_code) {
    const { data: fr } = await supabase
      .from("wilaya_fees")
      .select("priced, stopdesk_available")
      .eq("wilaya_code", order.wilaya_code)
      .maybeSingle();
    canSwitchToHome = !!fr && fr.priced && !fr.stopdesk_available;
  }
  if (isAdmin) {
    const { data: team } = await supabase
      .from("profiles")
      .select("user_id, display_name, role")
      .eq("is_active", true);
    for (const r of team ?? []) {
      const entry = { id: r.user_id, email: r.display_name ?? r.user_id.slice(0, 8) };
      if (r.role === "confirmation_agent") confirmationAgents.push(entry);
    }

    const { data: shipment } = await supabase
      .from("zr_shipments")
      .select("tracking_number, state, state_updated_at")
      .eq("order_id", order.id)
      .maybeSingle();
    if (shipment) {
      zrShipment = {
        trackingNumber: shipment.tracking_number,
        state: shipment.state,
        stateUpdatedAt: shipment.state_updated_at,
      };
    }

    // swap data: forward link (A→B) + reverse link (B←A) + wilaya list
    const { data: swappedFrom } = await supabase
      .from("orders")
      .select("id, order_seq")
      .eq("workspace_id", workspaceId)
      .eq("swapped_to_order_id", order.id)
      .limit(1)
      .maybeSingle();
    if (swappedFrom) swapData.swappedFrom = { id: swappedFrom.id, orderSeq: swappedFrom.order_seq };
    const { data: wilayas } = await supabase
      .from("wilayas")
      .select("code, name")
      .order("code");
    swapData.wilayas = wilayas ?? [];
  }

  const productSizes = isAdmin && order.product_id ? ((await loadProductVariants(supabase, [order.product_id])).get(order.product_id)?.variants ?? []) : [];
  const showsCard = isAdmin && productSizes.length > 0;

  const phone = order.customer?.phone ?? order.customer_phone;
  const isCancelled = order.confirmation_status === "cancelled" || order.delivery_status === "cancelled";

  return (
    <div className="space-y-6">
      <CrumbRecord label={formatOrderNo(order.order_seq)} />
      <PageHeader
        title={`${t("orders.edit")} ${ltr(formatOrderNo(order.order_seq))}`}
        subtitle={
          order.order_number ? (
            <>
              {t("orders.platformRef")}: <bdi dir="ltr">{order.order_number}</bdi>
            </>
          ) : (
            t(purposeKey(orderHome(role)))
          )
        }
      >
        {isAdmin ? (
          <DeleteButton table="orders" id={order.id} redirectTo="/app/sell/orders" />
        ) : null}
      </PageHeader>

      {swapData.swappedTo ? (
        <div>
          <SwapBadge to={swapData.swappedTo} />
        </div>
      ) : null}

      <div className="card-surface grid grid-cols-2 gap-4 rounded-xl p-5 sm:grid-cols-3 lg:grid-cols-4">
        <Meta label={t("fields.product")}>{order.product?.name ?? "—"}</Meta>
        {showsSizeCell(isAdmin, productSizes.length, order.variant) ? <SizeMeta label={t("orders.sizeTitle")} size={order.variant ?? ""} /> : null}
        <Meta label={t("fields.customer")}>
          <div>{order.customer?.name ?? order.customer_name ?? "—"}</div>
          {phone ? <PhoneLinks phone={phone} callLabel={t("orders.call")} waLabel={t("orders.whatsapp")} /> : null}
        </Meta>
        <Meta label={t("fields.quantity")}>{order.quantity}</Meta>
        <Meta label={t("fields.unit_price")}>{formatCurrency(order.sale_price)}</Meta>
        <Meta label={t("fields.total_amount")}>
          {formatCurrency((order.sale_price ?? 0) * order.quantity)}
        </Meta>
        <Meta label={t("orders.toCollect")}>
          <span className="num font-medium">{formatCurrency((order.sale_price ?? 0) * order.quantity + (order.delivery_fee ?? 0))}</span>
        </Meta>
        <Meta label={t("fields.wilaya")}>{order.wilaya ? <WilayaValue code={order.wilaya_code} name={order.wilaya.name} /> : "—"}</Meta>
        <Meta label={t("fields.city")}>{order.commune ?? "—"}</Meta>
        <Meta label={t("fields.address")}>{order.address ?? "—"}</Meta>
        <Meta label={t("fields.source")}>{t(`status.order_source.${order.source}`)}</Meta>
        <Meta label={t("fields.placed_at")}>{formatDateTime(order.placed_at)}</Meta>
      </div>

      {order.is_duplicate_suspect && order.duplicate_of ? (
        <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {t("orders.duplicateWarning")}{" "}
          <Link href={`/app/sell/orders/${order.duplicate_of}`} className="underline">
            {t("orders.viewDuplicate")}
          </Link>
        </div>
      ) : null}

      {showsCard ? (
        <VariantCard
          orderId={order.id}
          currentId={order.variant_id}
          oldLabel={order.variant}
          sizes={productSizes.map((v) => ({ id: v.id, label: v.label, isActive: v.isActive }))}
        />
      ) : null}

      <OrderTaxonomyCard
        orderId={order.id}
        tags={tags}
        selectedTagIds={(orderTags ?? []).map((t) => t.option_id)}
        reasons={reasons}
        cancellationReasonId={order.cancellation_reason_option_id}
        showReason={isCancelled}
        locked={!isAdmin && (order.delivery_status !== "wait_for_deposit" || !!zrExists)}
      />

      <OrderWorkflow order={order} role={role} events={events ?? []} actorNames={actorNames} />

      {isAdmin ? (
        <AssignmentCard
          orderId={order.id}
          confirmationAgent={order.assigned_confirmation_agent}
          deliveryAgent={order.assigned_delivery_agent}
          confirmationAgents={confirmationAgents}
        />
      ) : null}

      {isAdmin ? <ZRShipmentCard orderId={order.id} shipment={zrShipment} stopDesk={order.delivery_type === "stopdesk"} canSwitchToHome={canSwitchToHome} canSend={sendState.ok} notSendableReason={sendState.ok ? null : sendState.reason} /> : null}

      {isAdmin ? (
        <SwapCard
          orderId={order.id}
          deliveryStatus={order.delivery_status}
          swappedTo={swapData.swappedTo}
          swappedFrom={swapData.swappedFrom}
          wilayas={swapData.wilayas}
        />
      ) : null}
    </div>
  );
}
