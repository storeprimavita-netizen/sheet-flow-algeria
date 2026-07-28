import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isCurrentUserAdmin } from "@/lib/rbac";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { StatusPill } from "@/components/status-pill";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { DeleteButton } from "@/components/delete-button";
import { OrderWorkflow } from "../order-workflow";
import { AssignmentCard } from "./assignment-card";
import { ZRShipmentCard } from "./zr-shipment-card";

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const role = await getCurrentUserRole();
  const supabase = await createClient();

  const { data: order } = await supabase
    .from("orders")
    .select(
      "*, product:products(name, sku), customer:customers(name, phone, commune)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("orders.title")} />
        <Empty>{t("orders.notFound")}</Empty>
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

  // admin: agent rosters for the assignment card
  const confirmationAgents: { id: string; email: string }[] = [];
  const deliveryAgents: { id: string; email: string }[] = [];
  let zrShipment: { trackingNumber: string | null; state: string | null; stateUpdatedAt: string | null } | null = null;
  if (isAdmin) {
    const { data: team } = await supabase
      .from("profiles")
      .select("user_id, display_name, role")
      .eq("is_active", true);
    for (const r of team ?? []) {
      const entry = { id: r.user_id, email: r.display_name ?? r.user_id.slice(0, 8) };
      if (r.role === "confirmation_agent") confirmationAgents.push(entry);
      else if (r.role === "delivery_agent") deliveryAgents.push(entry);
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
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t("orders.edit")} ${order.order_number ?? order.id.slice(0, 8)}`}
      >
        {isAdmin ? (
          <DeleteButton table="orders" id={order.id} redirectTo="/app/orders" />
        ) : null}
      </PageHeader>

      <div className="card-surface grid grid-cols-2 gap-4 rounded-xl p-5 sm:grid-cols-3 lg:grid-cols-4">
        <Meta label={t("fields.product")}>{order.product?.name ?? "—"}</Meta>
        <Meta label={t("fields.customer")}>
          {order.customer?.name ?? order.customer_name ?? "—"}
          {order.customer?.phone ?? order.customer_phone
            ? ` · ${order.customer?.phone ?? order.customer_phone}`
            : ""}
        </Meta>
        <Meta label={t("fields.quantity")}>{order.quantity}</Meta>
        <Meta label={t("fields.unit_price")}>{formatCurrency(order.sale_price)}</Meta>
        <Meta label={t("fields.total_amount")}>
          {formatCurrency((order.sale_price ?? 0) * order.quantity)}
        </Meta>
        <Meta label={t("fields.city")}>{order.commune ?? "—"}</Meta>
        <Meta label={t("fields.address")}>{order.address ?? "—"}</Meta>
        <Meta label={t("fields.source")}>{order.source}</Meta>
        <Meta label={t("fields.placed_at")}>{formatDateTime(order.placed_at)}</Meta>
        <Meta label={t("fields.confirmation_status")}>
          <StatusPill kind="confirmation" status={order.confirmation_status} size="sm" />
        </Meta>
        <Meta label={t("fields.delivery_status")}>
          <StatusPill kind="delivery" status={order.delivery_status} size="sm" />
        </Meta>
      </div>

      {order.is_duplicate_suspect && order.duplicate_of ? (
        <div className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">
          {t("orders.duplicateWarning")}{" "}
          <Link href={`/app/orders/${order.duplicate_of}`} className="underline">
            {t("orders.viewDuplicate")}
          </Link>
        </div>
      ) : null}

      <OrderWorkflow order={order} role={role} events={events ?? []} actorNames={actorNames} />

      {isAdmin ? (
        <AssignmentCard
          orderId={order.id}
          confirmationAgent={order.assigned_confirmation_agent}
          deliveryAgent={order.assigned_delivery_agent}
          confirmationAgents={confirmationAgents}
          deliveryAgents={deliveryAgents}
        />
      ) : null}

      {isAdmin ? <ZRShipmentCard orderId={order.id} shipment={zrShipment} /> : null}
    </div>
  );
}
