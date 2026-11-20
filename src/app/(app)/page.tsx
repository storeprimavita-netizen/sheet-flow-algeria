import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/rbac";
import { roleHome } from "@/lib/role-home";

/** Role landing: agents on My day, admins (and role-less users) on the dashboard. */
export default async function Home() {
  const role = await getCurrentUserRole();
  redirect(role ? roleHome(role) : "/app/dashboard");
}
