import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/rbac";
import { roleHome } from "@/lib/role-home";

/** Agents only: an admin (or a user without a role) is sent to the dashboard. */
export default async function MyDayLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentUserRole();
  if (role !== "confirmation_agent" && role !== "delivery_agent") redirect(roleHome("admin"));
  return children;
}
