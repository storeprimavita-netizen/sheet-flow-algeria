import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, isCurrentUserAdmin } from "@/lib/rbac";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { DeleteButton } from "@/components/delete-button";
import { OrderWorkflow } from "../order-workflow";
import { AssignmentCard } from "./assignment-card";

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
      "*, product:products(name, sku), customer:contacts(name, phone, city)",
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
    .from("order_events")
    .select("*")
    .eq("order_id", id)
    .order("created_at", { ascending: false });

  const isAdmin = await isCurrentUserAdmin();

  // admin: agent rosters for the assignment card
  let confirmationAgents: { id: string; email: string }[] = [];
  let deliveryAgents: { id: string; email: string }[] = [];
  if (isAdmin) {
    const { data: team } = await supabase
      .from("team_directory")
      .select("user_id, email, role")
      .eq("is_team_member", true);
    for (const r of (team ?? []) as any[]) {
      const entry = { id: r.user_id, email: r.email ?? r.user_id.slice(0, 8) };
      if (r.role === "confirmation_agent") confirmationAgents.push(entry);
      else if (r.role === "delivery_agent") deliveryAgents.push(entry);
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

      <div className="glass-card grid grid-cols-2 gap-4 rounded-xl p-5 sm:grid-cols-3 lg:grid-cols-4">
        <Meta label={t("fields.product")}>{order.product?.name ?? "—"}</Meta>
        <Meta label={t("fields.customer")}>
          {order.customer?.name ?? "—"}
          {order.customer?.phone ? ` · ${order.customer.phone}` : ""}
        </Meta>
        <Meta label={t("fields.quantity")}>{order.quantity}</Meta>
        <Meta label={t("fields.unit_price")}>{formatCurrency(order.unit_price)}</Meta>
        <Meta label={t("fields.total_amount")}>{formatCurrency(order.total_amount)}</Meta>
        <Meta label={t("fields.city")}>{order.city ?? "—"}</Meta>
        <Meta label={t("fields.address")}>{order.address ?? "—"}</Meta>
        <Meta label={t("fields.source")}>{order.source}</Meta>
        <Meta label={t("fields.placed_at")}>{formatDateTime(order.placed_at)}</Meta>
        <Meta label={t("fields.confirmation_status")}>
          <Badge variant={order.confirmation_status === "confirmed" ? "default" : "secondary"}>
            {t(`status.confirmation_status.${order.confirmation_status}`)}
          </Badge>
        </Meta>
        <Meta label={t("fields.delivery_status")}>
          <Badge variant="secondary">
            {t(`status.delivery_status.${order.delivery_status}`)}
          </Badge>
        </Meta>
      </div>

      <OrderWorkflow order={order} role={role} events={events ?? []} />

      {isAdmin ? (
        <AssignmentCard
          orderId={order.id}
          confirmationAgent={order.assigned_confirmation_agent}
          deliveryAgent={order.assigned_delivery_agent}
          confirmationAgents={confirmationAgents}
          deliveryAgents={deliveryAgents}
        />
      ) : null}
    </div>
  );
}
