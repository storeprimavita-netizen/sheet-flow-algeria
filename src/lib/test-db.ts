import { execFileSync } from "node:child_process";

/** Local Supabase db container used by live-DB tests. */
export const DB_CONTAINER = process.env.LOCAL_DB_CONTAINER ?? "supabase_db_mnw-erp";

/** True when the local db container exists; live tests skip without it. */
export const dbContainerUp = (() => {
  try {
    execFileSync("docker", ["inspect", DB_CONTAINER], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();
