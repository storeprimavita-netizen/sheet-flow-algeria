import { redirect } from "next/navigation";

import { getProfile, requireAdmin } from "@/lib/rbac";
import { roleHome } from "@/lib/role-home";

/** Section layout guard: agents go straight to their role home, no profile to /no-access. */
export async function AdminGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/no-access");
  await requireAdmin(roleHome(profile.role));
  return children;
}
