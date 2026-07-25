import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * Service-role client — bypasses RLS. SERVER-ONLY: never import from a Client
 * Component or reference NEXT_PUBLIC-* vars alongside it. Used by webhook
 * routes (no user session) to read app_settings secrets and upsert orders.
 *
 * Requires `SUPABASE_SERVICE_ROLE_KEY` in the environment.
 */
export async function createAdminClient(): Promise<SupabaseClient<Database>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set",
    );
  }
  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
