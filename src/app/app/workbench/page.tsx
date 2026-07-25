import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Workbench, type WorkbenchOrder } from "./workbench";

const TERM_CONF = new Set(["confirmed", "cancelled"]);
const TERM_DELIV = new Set(["delivered", "returned", "cancelled"]);

export default async function WorkbenchPage() {
  const t = await getTranslations();
  const role = await getCurrentUserRole();
  const supabase = await createClient();

  // RLS scopes reads by stage already; we further drop terminal rows so the
  // queue shows only actionable orders.
  const { data: raw } = await supabase
    .from("orders")
    .select(
      "id, order_number, quantity, total_amount, unit_price, confirmation_status, delivery_status, confirmation_attempts, agent_comment, address, city, placed_at, assigned_confirmation_agent, assigned_delivery_agent, product:products(name), customer:contacts(name, phone)",
    )
    .order("created_at", { ascending: true });

  const canConfirm = role === "admin" || role === "confirmation_agent";
  const canDeliver = role === "admin" || role === "delivery_agent";

  const orders: WorkbenchOrder[] = (raw ?? [])
    .filter((o: any) => {
      const confActionable = canConfirm && !TERM_CONF.has(o.confirmation_status);
      const delivActionable = canDeliver && !TERM_DELIV.has(o.delivery_status);
      return confActionable || delivActionable;
    })
    .map((o: any) => ({
      id: o.id,
      order_number: o.order_number,
      quantity: o.quantity,
      total_amount: o.total_amount,
      unit_price: o.unit_price,
      confirmation_status: o.confirmation_status,
      delivery_status: o.delivery_status,
      confirmation_attempts: o.confirmation_attempts ?? 0,
      agent_comment: o.agent_comment,
      address: o.address,
      city: o.city,
      placed_at: o.placed_at,
      product_name: o.product?.name ?? null,
      customer_name: o.customer?.name ?? null,
      customer_phone: o.customer?.phone ?? null,
      assigned_confirmation_agent: o.assigned_confirmation_agent,
      assigned_delivery_agent: o.assigned_delivery_agent,
    }));

  // admin sees who's on what — agents don't need it.
  let agents: Record<string, string> = {};
  if (role === "admin") {
    const { data: team } = await supabase.from("team_directory").select("user_id, email");
    agents = Object.fromEntries((team ?? []).map((r: any) => [r.user_id, r.email ?? r.user_id.slice(0, 8)]));
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("workbench.title")} subtitle={t("workbench.subtitle")} />

      {!orders.length ? (
        <Empty>{t("workbench.none")}</Empty>
      ) : (
        <Workbench orders={orders} role={role} agents={agents} />
      )}
    </div>
  );
}
