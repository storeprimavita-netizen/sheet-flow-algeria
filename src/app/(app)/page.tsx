import { redirect } from "next/navigation";

import { getCurrentUserRole, getUser } from "@/lib/rbac";
import { roleHome } from "@/lib/role-home";

/** Role landing: agents on My day, admins on the dashboard, signed-out on login, no profile on /no-access. */
export default async function Home() {
  if (!(await getUser())) redirect("/login");
  redirect(roleHome(await getCurrentUserRole()));
}
