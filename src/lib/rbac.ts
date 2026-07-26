import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/roles";

export type Profile = { role: Role; workspaceId: string };

/**
 * The signed-in user's profile row (`public.profiles`, RLS-scoped).
 * Returns null when not signed in, inactive, or not yet in a workspace.
 *
 * RLS is the real enforcement boundary; this is for UI/UX gating only.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role, workspace_id, is_active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data?.is_active || !data.workspace_id) return null;
  return { role: data.role as Role, workspaceId: data.workspace_id };
}

export async function getCurrentUserRole(): Promise<Role | null> {
  return (await getProfile())?.role ?? null;
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

/** Server-action guard: throws instead of redirecting (no response to redirect). */
export async function requireAdminProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") throw new Error("Forbidden");
  return profile;
}
