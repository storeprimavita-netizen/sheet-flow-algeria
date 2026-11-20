import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, test } from "vitest";

const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const psql = (sql: string) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_mnw-erp", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

const ZERO = "00000000-0000-0000-0000-000000000000";

describe.skipIf(!URL)("options / option_sets: no anon grant (live DB, 00074)", () => {
  const anon = () => createClient(URL!, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  test("options: anon has no table grant", () => {
    const out = psql(
      "select count(*) from information_schema.role_table_grants where grantee='anon' and table_schema='public' and table_name in ('options','option_sets');",
    );
    expect(out.trim()).toBe("0");
  });

  test("authenticated keeps CRUD on both tables", () => {
    const out = psql(
      "select count(*) from information_schema.role_table_grants where grantee='authenticated' and table_schema='public' and table_name in ('options','option_sets') and privilege_type in ('SELECT','INSERT','UPDATE','DELETE');",
    );
    expect(out.trim()).toBe("8");
  });

  test("options: anon select/insert/update/delete all error 42501", async () => {
    const t = () => anon().from("options");
    expect((await t().select("id").limit(1)).error?.code).toBe("42501");
    expect((await t().insert({ workspace_id: ZERO, set_id: ZERO, label: "x" })).error?.code).toBe("42501");
    expect((await t().update({ label: "y" }).eq("id", ZERO)).error?.code).toBe("42501");
    expect((await t().delete().eq("id", ZERO)).error?.code).toBe("42501");
  });

  test("option_sets: anon select/insert/update/delete error 42501", async () => {
    const t = () => anon().from("option_sets");
    expect((await t().select("id").limit(1)).error?.code).toBe("42501");
    expect((await t().insert({ workspace_id: ZERO, key: "x", label: "x" })).error?.code).toBe("42501");
    expect((await t().update({ label: "y" }).eq("id", ZERO)).error?.code).toBe("42501");
    expect((await t().delete().eq("id", ZERO)).error?.code).toBe("42501");
  });
});
