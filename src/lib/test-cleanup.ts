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
  for (const t of ["options", "option_sets", "settings", "wilaya_fees"]) await svc.from(t).delete().in("workspace_id", ids);
  await deleteWorkspaces(svc, ids);
  return ids.length;
}
