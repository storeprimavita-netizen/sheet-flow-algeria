import type { SupabaseClient } from "@supabase/supabase-js";

/** Test-only: delete workspaces, retrying up to 3 times when Postgres reports a deadlock (40P01). */
export async function deleteWorkspaces(svc: SupabaseClient, ids: string[]) {
  let res = await svc.from("workspaces").delete().in("id", ids);
  for (let i = 1; i < 3 && res.error?.code === "40P01"; i++) {
    await new Promise((r) => setTimeout(r, 200 * i));
    res = await svc.from("workspaces").delete().in("id", ids);
  }
  return res;
}
