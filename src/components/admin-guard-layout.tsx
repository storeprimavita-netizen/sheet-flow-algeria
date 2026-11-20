import { getProfile, requireAdmin } from "@/lib/rbac";
import { roleHome } from "@/lib/role-home";

/** Section layout guard: agents go straight to their role home. */
export async function AdminGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  await requireAdmin(profile ? roleHome(profile.role) : "/app/orders");
  return children;
}
