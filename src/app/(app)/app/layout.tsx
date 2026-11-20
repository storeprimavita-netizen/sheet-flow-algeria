import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { ACTIONABLE_CONFIRMATION, ACTIONABLE_DELIVERY } from "@/lib/statuses";
import { getCurrentUserRole, getUser } from "@/lib/rbac";
import { AppShell } from "@/components/app-shell";
import { StatusLabelsProvider } from "@/components/status-labels-provider";
import { getStatusLabelOverrides } from "@/lib/status-labels";

/** Auth gate for all /app/* routes (defense-in-depth; the proxy already redirects). */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  // Live nav counters — RLS-scoped, so agents see their own queue counts.
  const [role, overrides, confirmation, delivery, tasks] = await Promise.all([
    getCurrentUserRole(),
    getStatusLabelOverrides(),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("confirmation_status", ACTIONABLE_CONFIRMATION),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("confirmation_status", "confirmed")
      .in("delivery_status", ACTIONABLE_DELIVERY), // = the delivery queue's default rows
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("owner", user.id)
      .neq("status", "done"),
  ]);

  const counts = {
    confirmation: confirmation.count ?? 0,
    delivery: delivery.count ?? 0,
    tasks: tasks.count ?? 0,
  };

  return (
    <StatusLabelsProvider overrides={overrides}>
      <AppShell user={{ email: user.email ?? "" }} role={role} counts={counts}>
        {children}
      </AppShell>
    </StatusLabelsProvider>
  );
}
