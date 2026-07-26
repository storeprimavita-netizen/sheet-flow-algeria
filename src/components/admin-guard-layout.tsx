import { requireAdmin } from "@/lib/rbac";

/** Section layout guard: agents redirect to their Orders queue. */
export async function AdminGuardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin("/app/orders");
  return children;
}
