import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/rbac";
import { roleHome } from "@/lib/role-home";

/** Agents only: an admin goes to the dashboard, a user without a profile to /no-access. */
export default async function MyDayLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentUserRole();
  if (!role) redirect("/no-access");
  if (role !== "confirmation_agent" && role !== "delivery_agent") redirect(roleHome("admin"));
  return children;
}
