import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/rbac";

/** Role-based landing: admins get the full list, agents their own queue. */
export default async function OrdersIndexPage() {
  const role = await getCurrentUserRole();
  if (role === "confirmation_agent") redirect("/app/sell/confirmation");
  if (role === "delivery_agent") redirect("/app/sell/shipping");
  redirect("/app/sell/orders");
}
