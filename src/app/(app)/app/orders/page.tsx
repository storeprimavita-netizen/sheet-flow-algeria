import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/rbac";
import { roleHome } from "@/lib/role-home";

/** Role-based landing: admins get the full list, agents My day. */
export default async function OrdersIndexPage() {
  const role = await getCurrentUserRole();
  if (!role) redirect("/no-access");
  if (role === "confirmation_agent" || role === "delivery_agent") redirect(roleHome(role));
  redirect("/app/sell/orders");
}
