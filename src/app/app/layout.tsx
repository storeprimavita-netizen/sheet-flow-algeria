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

  // Live nav counters — RLS-scoped, so agents see their own queue counts.
  const [confirmation, delivery, tasks] = await Promise.all([
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .in("confirmation_status", ["wait_for_confirmation", "no_answer", "closed_phone"]),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("delivery_status", "wait_for_deposit"),
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
    <AppShell user={{ email: user.email ?? "" }} role={role} counts={counts}>
      {children}
    </AppShell>
  );
}
