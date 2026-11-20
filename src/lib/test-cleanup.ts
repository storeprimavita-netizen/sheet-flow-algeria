import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Audited workspace-owned tables (those with an audit_row() trigger), children before parents.
 * Their cascade-delete would fire audit_row() for a workspace that is already gone and break
 * audit_log_workspace_id_fkey (23503), so deleteWorkspaces empties them first. test-cleanup.test.ts
 * fails when a table gets an audit_row() trigger without being listed here.
 */
export const AUDITED_WORKSPACE_TABLES = [
  "season_periods",
  "seasons",
  "status_label_overrides",
  "reviews",
  "cash_collections",
  "zr_shipments",
  "expenses",
  "account_topups",
  "accounts",
  "product_option_values",
  "product_options",
  "product_pricing",
  "product_costs",
  "fixed_fees",
  "exchange_rates",
  "integration_configs",
  "store_pages",
  "stores",
  "wilaya_fees",
  "options",
  "option_sets",
  "settings",
] as const;

/** Not audited, but they reference audited option tables, which cannot be deleted while variants exist. */
const VARIANT_TABLES = ["product_variant_values", "product_variants"] as const;

/**
 * Test-only: delete workspaces, retrying up to 3 times when Postgres reports a deadlock (40P01).
 * Audited tables are emptied first (see AUDITED_WORKSPACE_TABLES). Only the given workspaces are touched.
 */
export async function deleteWorkspaces(svc: SupabaseClient, ids: string[]) {
  for (const t of VARIANT_TABLES) await svc.from(t).delete().in("workspace_id", ids);
  for (const t of AUDITED_WORKSPACE_TABLES) await svc.from(t).delete().in("workspace_id", ids);
  let res = await svc.from("workspaces").delete().in("id", ids);
  for (let i = 1; i < 3 && res.error?.code === "40P01"; i++) {
    await new Promise((r) => setTimeout(r, 200 * i));
    res = await svc.from("workspaces").delete().in("id", ids);
  }
  return res;
}

/**
 * Test-only: remove workspaces (and their users) a crashed or timed-out earlier run of a suite left
 * behind. Matches the suite's name prefix and only rows older than `minAgeMs`, so a run in progress is safe.
 */
export async function deleteLeakedWorkspaces(svc: SupabaseClient, prefix: string, minAgeMs = 5 * 60_000) {
  const cutoff = new Date(Date.now() - minAgeMs).toISOString();
  const { data } = await svc.from("workspaces").select("id").like("name", `${prefix}%`).lt("created_at", cutoff);
  const ids = (data ?? []).map((w) => w.id as string);
  if (!ids.length) return 0;
  const { data: members } = await svc.from("profiles").select("user_id").in("workspace_id", ids);
  for (const m of members ?? []) await svc.auth.admin.deleteUser(m.user_id as string);
  await deleteWorkspaces(svc, ids);
  return ids.length;
}
