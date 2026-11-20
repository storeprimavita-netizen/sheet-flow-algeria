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

describe.skipIf(!URL)("anon has no grant on any public relation (live DB, 00075)", () => {
  const anon = () => createClient(URL!, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  test("anon has no grant on any public table or view", () => {
    const out = psql(
      "select count(*) from information_schema.role_table_grants where grantee='anon' and table_schema='public';",
    );
    expect(out.trim()).toBe("0");
  });

  test("anon has no sequence privilege in public", () => {
    const out = psql(
      `select count(*) from (
         select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relkind='S' offset 0) s
        where has_sequence_privilege('anon', s.oid, 'usage,select,update');`,
    );
    expect(out.trim()).toBe("0");
  });

  test("default privileges: postgres/public gives anon nothing", () => {
    const out = psql(
      `select count(*) from pg_default_acl d
         join pg_namespace s on s.oid=d.defaclnamespace and s.nspname='public'
         join pg_roles o on o.oid=d.defaclrole and o.rolname='postgres',
         lateral aclexplode(d.defaclacl) a
         join pg_roles g on g.oid=a.grantee and g.rolname='anon'
        where d.defaclobjtype in ('r','S');`,
    );
    expect(out.trim()).toBe("0");
  });

  test("anon select on orders, profiles, settings, wilayas, agent_performance errors 42501", async () => {
    for (const t of ["orders", "profiles", "settings", "wilayas", "agent_performance"]) {
      const r = await anon().from(t).select("*").limit(1);
      expect(r.error?.code, t).toBe("42501");
    }
  });

  test("a table, view and sequence created after the migration get no anon grant", () => {
    const out = psql(
      `begin;
       create table public.__nav4s2_probe(id serial);
       create view public.__nav4s2_v as select 1 as x;
       select has_table_privilege('anon','public.__nav4s2_probe','select,insert,update,delete')
           || ',' || has_table_privilege('anon','public.__nav4s2_v','select')
           || ',' || has_sequence_privilege('anon','public.__nav4s2_probe_id_seq','usage');
       rollback;`,
    );
    expect(out).toContain("false,false,false");
  });

  test("anon select fails 42501 on every table/view/matview in public", async () => {
    const names = psql(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind in ('r','p','v','m') and c.relispartition=false order by 1;`,
    )
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    expect(names.length).toBeGreaterThan(30);
    const bad: string[] = [];
    for (const t of names) {
      const r = await anon().from(t).select("*").limit(1);
      if (r.error?.code !== "42501") bad.push(`${t}:${r.error?.code ?? "ok"}`);
    }
    expect(bad).toEqual([]);
  });

  test("anon insert/update/delete on orders and settings fail 42501", async () => {
    for (const name of ["orders", "settings"]) {
      const t = () => anon().from(name);
      expect((await t().insert({ workspace_id: ZERO })).error?.code, `${name} insert`).toBe("42501");
      expect((await t().update({ workspace_id: ZERO }).eq("workspace_id", ZERO)).error?.code, `${name} update`).toBe("42501");
      expect((await t().delete().eq("workspace_id", ZERO)).error?.code, `${name} delete`).toBe("42501");
    }
  });

  test("anon call to dashboard_stats errors", async () => {
    const r = await anon().rpc("dashboard_stats");
    expect(r.error).not.toBeNull();
  });

  test("authenticated and service_role keep absolute grants", () => {
    const rows = ["orders", "profiles", "settings", "wilayas"]
      .map((t) => `has_table_privilege('authenticated','public.${t}','select,insert,update,delete')`)
      .concat(
        "has_table_privilege('authenticated','public.agent_performance','select')",
        ...["orders", "profiles", "settings", "wilayas"].map(
          (t) => `has_table_privilege('service_role','public.${t}','select,insert,update,delete')`,
        ),
      );
    const out = psql(`select ${rows.join(" and ")};`);
    expect(out.trim()).toBe("t");
  });
});
