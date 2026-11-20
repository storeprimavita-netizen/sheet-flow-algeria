import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, test } from "vitest";

import { deleteWorkspaces } from "@/lib/test-cleanup";

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

const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_PASSWORD = "SeedDev!2026";
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
      const ins = await t().insert({ workspace_id: ZERO });
      expect(ins.error?.code, `${name} insert`).toBe("42501");
      expect(ins.error?.message, `${name} insert`).toMatch(/permission denied for table/);
      const upd = await t().update({ workspace_id: ZERO }).eq("workspace_id", ZERO);
      expect(upd.error?.code, `${name} update`).toBe("42501");
      expect(upd.error?.message, `${name} update`).toMatch(/permission denied for table/);
      expect((await t().delete().eq("workspace_id", ZERO)).error?.code, `${name} delete`).toBe("42501");
    }
  });

  test("anon has no column, matview, foreign table or sequence privilege (pg_class sweep)", () => {
    const out = psql(
      `select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public'
          and ((c.relkind in ('r','p','v','m','f')
                and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')
                     or has_any_column_privilege('anon', c.oid, 'select,insert,update,references')))
            or (c.relkind='S' and has_sequence_privilege('anon', c.oid, 'usage,select,update')));`,
    );
    expect(out.trim()).toBe("");
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

describe.skipIf(!URL)("anon and PUBLIC execute no public function (live DB, 00076)", () => {
  const anon = () => createClient(URL!, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const sweep = (role: string) =>
    psql(
      `select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and has_function_privilege('${role}', p.oid, 'execute') order by 1;`,
    ).trim();

  test("anon cannot execute any public function", () => {
    expect(sweep("anon")).toBe("");
  });

  test("no public function is executable by PUBLIC", () => {
    expect(sweep("public")).toBe("");
  });

  test("default privileges: postgres gives anon and PUBLIC no function execute", () => {
    const out = psql(
      `select count(*) from pg_default_acl d
         left join pg_namespace s on s.oid=d.defaclnamespace,
         lateral aclexplode(d.defaclacl) a
        where d.defaclrole='postgres'::regrole and d.defaclobjtype='f'
          and (a.grantee=0 or a.grantee='anon'::regrole) and (d.defaclnamespace=0 or s.nspname='public');`,
    );
    expect(out.trim()).toBe("0");
    const global = psql(
      `select count(*) from pg_default_acl where defaclrole='postgres'::regrole and defaclnamespace=0 and defaclobjtype='f';`,
    );
    expect(global.trim()).toBe("1");
  });

  test("a function created after the migration is not anon-executable; authenticated/service_role are; new schema gives none", () => {
    const out = psql(
      `begin;
       create function public.__s3_probe() returns int language sql as 'select 1';
       create schema __s3_probe_schema;
       create function __s3_probe_schema.f() returns int language sql as 'select 1';
       select has_function_privilege('anon','public.__s3_probe()','execute')
           || ',' || has_function_privilege('public','public.__s3_probe()','execute')
           || ',' || has_function_privilege('authenticated','public.__s3_probe()','execute')
           || ',' || has_function_privilege('service_role','public.__s3_probe()','execute')
           || ',' || has_function_privilege('authenticated','__s3_probe_schema.f()','execute');
       rollback;`,
    );
    expect(out).toContain("false,false,true,true,false");
  });

  test("anon rpc of dashboard_stats, normalize_dz_phone, stock_order_reasons, is_admin: permission denied for function", async () => {
    const calls: [string, Record<string, unknown>?][] = [
      ["dashboard_stats"],
      ["normalize_dz_phone", { p: "0555123456" }],
      ["stock_order_reasons"],
      ["is_admin"],
    ];
    for (const [fn, args] of calls) {
      const r = await anon().rpc(fn, args);
      expect(r.error?.message, fn).toMatch(/permission denied for function/);
    }
  });

  test("service_role keeps execute on kpi and pnl helpers; authenticated on the RLS helpers", () => {
    const out = psql(
      `select bool_and(has_function_privilege('service_role', p.oid, 'execute'))
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and (p.proname like 'kpi\\_%' or p.proname like 'pnl\\_%')
       union all
       select bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
         from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='public' and p.proname in ('current_workspace_id','is_admin','current_app_role','dashboard_stats');`,
    );
    expect(out.trim().split("\n")).toEqual(["t", "t"]);
  });

  describe("signed-in behaviour is unchanged", () => {
    const userIds: string[] = [];
    let wsId: string | undefined;
    const svc = () => createClient(URL!, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    afterAll(async () => {
      const c = svc();
      for (const id of userIds) await c.auth.admin.deleteUser(id);
      if (wsId) await deleteWorkspaces(c, [wsId]);
    });

    test("auth admin createUser still creates a profile; an agent session reads current_fx_rate and dashboard_stats", async () => {
      const c = svc();
      wsId = (await c.from("workspaces").insert({ name: `s3-${crypto.randomUUID()}` }).select("id").single()).data!.id as string;
      const email = `s3-agent-${crypto.randomUUID()}@test.mnw`;
      const { data, error } = await c.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
      expect(error).toBeNull();
      userIds.push(data.user!.id);
      const prof = await c.from("profiles").select("user_id").eq("user_id", data.user!.id);
      expect(prof.data).toHaveLength(1);
      await c.from("profiles").update({ workspace_id: wsId, role: "confirmation_agent", is_active: true }).eq("user_id", data.user!.id);
      const agent = createClient(URL!, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const s = await agent.auth.signInWithPassword({ email, password: SEED_PASSWORD });
      expect(s.error).toBeNull();
      const fx = await agent.rpc("current_fx_rate", { p_ws: wsId, p_currency: "USD" });
      expect(fx.error).toBeNull();
      const ds = await agent.rpc("dashboard_stats");
      expect(ds.error).toBeNull();
      expect(ds.data).not.toBeNull();
      expect((await agent.from("orders").select("id").limit(1)).error).toBeNull();
    });
  });
});
