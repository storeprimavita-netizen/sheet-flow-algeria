import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

/**
 * The signed-in user's role, read from `public.user_roles` (RLS-scoped).
 * Returns null when not signed in or when no role row exists yet.
 *
 * RLS is the real enforcement boundary; this is for UI/UX gating only.
 */
export async function getCurrentUserRole(): Promise<Role | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data?.role as Role | undefined) ?? null;
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await getCurrentUserRole()) === "admin";
}

/**
 * Server-side UX gate for admin-only pages. RLS still enforces writes; this
 * just keeps non-admins out of write screens and shows them the dashboard.
 */
export async function requireAdmin(redirectTo = "/app/dashboard"): Promise<void> {
  if (!(await isCurrentUserAdmin())) redirect(redirectTo);
}
