import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Test-only: delete workspaces, retrying up to 3 times when Postgres reports a deadlock (40P01).
 * Audited tables seeded for every workspace (seasons, 00061) are emptied first: their cascade-delete
 * would fire audit_row() for a workspace that is already gone and break audit_log_workspace_id_fkey.
 */
export async function deleteWorkspaces(svc: SupabaseClient, ids: string[]) {
  await svc.from("season_periods").delete().in("workspace_id", ids);
  await svc.from("seasons").delete().in("workspace_id", ids);
  let res = await svc.from("workspaces").delete().in("id", ids);
  for (let i = 1; i < 3 && res.error?.code === "40P01"; i++) {
    await new Promise((r) => setTimeout(r, 200 * i));
    res = await svc.from("workspaces").delete().in("id", ids);
  }
  return res;
}
