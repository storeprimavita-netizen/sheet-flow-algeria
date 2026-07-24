import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell";

/** Auth gate for all /app/* routes (defense-in-depth; the proxy already redirects). */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getCurrentUserRole();

  return (
    <AppShell user={{ email: user.email ?? "" }} role={role}>
      {children}
    </AppShell>
  );
}
