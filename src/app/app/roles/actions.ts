"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/rbac";
import type { Enums } from "@/lib/supabase/database.types";

export type RoleResult = { ok: true } | { ok: false; error: string };

/** Absolute origin from request headers, for Supabase email-link redirects. */
async function origin(): Promise<string | null> {
  const h = await headers();
  const host = h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Admin: set a user's app_role. Uses the session client so the guard trigger's
 *  is_admin()/auth.uid() resolves to the calling admin. */
export async function setRole(userId: string, role: Enums<"app_role">): Promise<RoleResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "admin only" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_roles")
    .upsert({ user_id: userId, role }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/app/roles");
  return { ok: true };
}

/** Admin: invite a new user by email and assign their initial role. The invite
 *  email is sent by Supabase; handle_new_user already gives them a default
 *  confirmation_agent row, which we overwrite with the chosen role. */
export async function inviteUser(email: string, role: Enums<"app_role">): Promise<RoleResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "admin only" };
  const admin = await createAdminClient();
  const base = await origin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
    redirectTo: base ? `${base}/auth/callback?next=/app/dashboard` : undefined,
  });
  if (error) return { ok: false, error: error.message };

  const supabase = await createClient();
  const { error: rErr } = await supabase
    .from("user_roles")
    .upsert({ user_id: data.user.id, role }, { onConflict: "user_id" });
  if (rErr) return { ok: false, error: rErr.message };

  revalidatePath("/app/roles");
  return { ok: true };
}

/** Admin: send a Supabase recovery email so the user can set a new password. */
export async function sendResetEmail(email: string): Promise<RoleResult> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "admin only" };
  const base = await origin();
  const redirectTo = base ? `${base}/auth/callback?next=/reset-password` : undefined;
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
