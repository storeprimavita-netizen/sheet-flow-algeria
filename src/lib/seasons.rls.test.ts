import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteLeakedWorkspaces, deleteWorkspaces } from "@/lib/test-cleanup";

/** Live STATS-3 checks (migration 00061): filter set, drop of old signatures, seasons RLS. */
const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_PASSWORD = "SeedDev!2026";

const psql = (sql: string) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_mnw-erp", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(email: string) {
  const c = client(ANON_KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}

type Rates = { counts: { received: number; confirmed: number; delivered: number } };

const DAY = "2026-03-10";
const NOON = `${DAY}T12:00:00Z`;

describe.skipIf(!URL)("seasons + kpi filters (live DB, 00061)", () => {
  let svc: SupabaseClient;
  let admin: SupabaseClient;
  let confAgent: SupabaseClient;
  let delAgent: SupabaseClient;
  let ws2Admin: SupabaseClient;
  let ws: string;
  let ws2: string;
  let agentId: string;
  const users: string[] = [];
  const tag = () => `ss-${crypto.randomUUID()}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent" | "delivery_agent") {
    const email = `ss-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return { c: await signIn(email), id: data.user.id };
  }
  async function product(over: Record<string, unknown> = {}) {
    const { data, error } = await svc.from("products").insert({ workspace_id: ws, name: tag(), ...over }).select("id").single();
    expect(error).toBeNull();
    return data!.id as string;
  }
  async function order(p: string, over: Record<string, unknown> = {}) {
    const { data, error } = await svc
      .from("orders")
      .insert({
        workspace_id: ws, product_id: p, quantity: 1, sale_price: 1000, placed_at: NOON,
        confirmation_status: "confirmed", wilaya_code: 16, commune: "Bab Ezzouar", ...over,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }
  async function set(p: string, filters: unknown, c = admin) {
    const { data, error } = await c.rpc("kpi_order_set", {
      p_from: DAY, p_to: DAY, p_product: [p], p_filters: filters as never,
    });
    expect(error).toBeNull();
    return (data ?? []).map((r: { id: string }) => r.id).sort();
  }

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    await deleteLeakedWorkspaces(svc, "ss-"); // left by a crashed earlier run (tag() names)
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    admin = (await userIn(ws, "admin")).c;
    const a = await userIn(ws, "confirmation_agent");
    confAgent = a.c;
    agentId = a.id;
    delAgent = (await userIn(ws, "delivery_agent")).c;
    ws2Admin = (await userIn(ws2, "admin")).c;
    psql(`select public.seed_workspace('${ws}'); select public.seed_workspace('${ws}');`);
    psql(`select public.seed_workspace('${ws2}');`);
  }, 30000);
  afterAll(async () => {
    if (!svc) return;
    const wss = [ws, ws2].filter(Boolean);
    // audited tables: delete while the workspace exists (the audit trigger needs it)
    await svc.from("season_periods").delete().in("workspace_id", wss);
    for (const t of ["seasons", "options", "option_sets", "settings", "wilaya_fees"]) await svc.from(t).delete().in("workspace_id", wss);
    expect((await deleteWorkspaces(svc, wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("one signature per changed function; anon denied", async () => {
    const out = psql(
      `select proname||':'||count(*) from pg_proc where proname in ('kpi_order_set','kpi_by_wilaya','kpi_by_commune','kpi_drill_orders','kpi_set_rates') group by proname order by 1;`,
    );
    expect(out.trim().split("\n")).toEqual([
      "kpi_by_commune:1", "kpi_by_wilaya:1", "kpi_drill_orders:1", "kpi_order_set:1", "kpi_set_rates:1",
    ]);
    const anon = client(ANON_KEY);
    expect((await anon.rpc("kpi_set_rates", {})).error).not.toBeNull();
    expect((await anon.rpc("kpi_order_set", {})).error).not.toBeNull();
  });

  test("null and {} equal the unfiltered set; malformed filters match nothing and never throw", async () => {
    const p = await product();
    await order(p);
    await order(p, { wilaya_code: 31 });
    const all = await set(p, null);
    expect(all.length).toBe(2);
    expect(await set(p, {})).toEqual(all);
    for (const bad of [[], "x", { wilaya: "abc" }, { source: "foo" }, { agent: "not-uuid" }, { source: null }, { bogus: 1 }, { wilaya: 16 }]) {
      expect(await set(p, bad)).toEqual([]);
    }
  });

  test("each filter alone and combined equals the direct count", async () => {
    const cat = (await svc.from("option_sets").select("id").eq("workspace_id", ws).eq("key", "product_category").single()).data!.id;
    const opt = (await svc.from("options").select("id").eq("set_id", cat).limit(1).single()).data!.id as string;
    const pc = await product({ category_option_id: opt });
    const pn = await product();
    const a = await order(pc, { wilaya_code: 16, source: "manual", assigned_confirmation_agent: agentId, delivery_type: "home" });
    const b = await order(pc, { wilaya_code: 31, source: "shopify", delivery_type: "stopdesk" });
    const c = await order(pn, { wilaya_code: 16, source: "manual", delivery_type: "home" });
    const range = async (filters: unknown) => {
      const { data } = await admin.rpc("kpi_order_set", { p_from: DAY, p_to: DAY, p_filters: filters as never });
      return (data ?? []).map((r: { id: string }) => r.id).filter((i: string) => [a, b, c].includes(i)).sort();
    };
    expect(await range({ category: opt })).toEqual([a, b].sort());
    expect(await range({ wilaya: "16" })).toEqual([a, c].sort());
    expect(await range({ source: "shopify" })).toEqual([b]);
    expect(await range({ agent: agentId })).toEqual([a]);
    expect(await range({ delivery_type: "stopdesk" })).toEqual([b]);
    expect(await range({ category: opt, wilaya: "16", source: "manual", agent: agentId, delivery_type: "home" })).toEqual([a]);
    expect(await range({ category: opt, wilaya: "31", source: "manual" })).toEqual([]);
  });

  test("kpi_set_rates matches kpi_rates, is admin only, and is not row-capped", async () => {
    const p = await product();
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) ids.push(await order(p));
    const { data: direct } = await admin.rpc("kpi_rates", { p_order_ids: ids, p_from: DAY, p_to: DAY });
    const { data, error } = await admin.rpc("kpi_set_rates", { p_from: DAY, p_to: DAY, p_product: [p], p_filters: { wilaya: "16" } });
    expect(error).toBeNull();
    expect(data).toEqual(direct);
    expect((data as unknown as Rates).counts.received).toBe(3);
    expect((await confAgent.rpc("kpi_set_rates", { p_from: DAY, p_to: DAY, p_product: [p] })).data).toBeNull();
    expect((await delAgent.rpc("kpi_set_rates", { p_from: DAY, p_to: DAY, p_product: [p] })).data).toBeNull();
    // > 1000 orders in one set, bulk inserted in SQL
    const big = await product();
    psql(`insert into public.orders (workspace_id, product_id, quantity, sale_price, placed_at, confirmation_status, wilaya_code)
          select '${ws}', '${big}', 1, 1000, '${NOON}', 'confirmed', 16 from generate_series(1, 1100);`);
    const r = await admin.rpc("kpi_set_rates", { p_from: DAY, p_to: DAY, p_product: [big] });
    expect((r.data as unknown as Rates).counts.received).toBe(1100);
  }, 60000);

  test("drill total equals the table count and honours filters", async () => {
    const p = await product();
    await order(p, { source: "manual" });
    await order(p, { source: "manual" });
    await order(p, { source: "shopify" });
    const f = { source: "manual" };
    const { data: rates } = await admin.rpc("kpi_set_rates", { p_from: DAY, p_to: DAY, p_product: [p], p_filters: f });
    const { data: drill } = await admin.rpc("kpi_drill_orders", {
      p_metric: "received", p_from: DAY, p_to: DAY, p_product: [p], p_filters: f,
    });
    expect(Number(drill?.[0]?.total)).toBe((rates as unknown as Rates).counts.received);
    expect(Number(drill?.[0]?.total)).toBe(2);
    const w = await admin.rpc("kpi_by_wilaya", { p_from: DAY, p_to: DAY, p_product: [p], p_filters: f });
    expect((w.data![0].rates as unknown as Rates).counts.received).toBe(2);
  });

  test("non-admin gets 0 rows from kpi_by_wilaya, kpi_by_commune, kpi_drill_orders", async () => {
    const p = await product();
    await order(p);
    const args = { p_from: DAY, p_to: DAY, p_product: [p] };
    expect((await admin.rpc("kpi_by_wilaya", args)).data!.length).toBeGreaterThan(0);
    for (const a of [confAgent, delAgent]) {
      expect((await a.rpc("kpi_by_wilaya", args)).data ?? []).toEqual([]);
      expect((await a.rpc("kpi_by_commune", { ...args, p_wilaya: 16 })).data ?? []).toEqual([]);
      expect((await a.rpc("kpi_drill_orders", { ...args, p_metric: "received" })).data ?? []).toEqual([]);
    }
  });

  test("drill parity category/conf_agent: drill ids equal the direct orders query", async () => {
    const cat = (await svc.from("option_sets").select("id").eq("workspace_id", ws).eq("key", "product_category").single()).data!.id;
    const opt = (await svc.from("options").select("id").eq("set_id", cat).limit(1).single()).data!.id as string;
    const pc = await product({ category_option_id: opt });
    const po = await product();
    const a = await order(pc, { assigned_confirmation_agent: agentId });
    await order(pc);
    await order(po, { assigned_confirmation_agent: agentId });
    const ids = async (filters: Record<string, string>) =>
      ((await admin.rpc("kpi_drill_orders", { p_metric: "received", p_from: DAY, p_to: DAY, p_product: [pc, po], p_filters: filters })).data ?? [])
        .map((r: { id: string }) => r.id).sort();
    const inCat = (await admin.from("orders").select("id").eq("product_id", pc)).data!.map((r) => r.id as string).sort();
    expect(await ids({ category: opt })).toEqual(inCat);
    const byAgent = (await admin.from("orders").select("id").in("product_id", [pc, po]).eq("assigned_confirmation_agent", agentId)).data!.map((r) => r.id as string).sort();
    expect(await ids({ agent: agentId })).toEqual(byAgent);
    expect(await ids({ category: opt, agent: agentId })).toEqual([a]);
  });

  test("wilaya_stats and product_stats views still work", async () => {
    expect((await admin.from("wilaya_stats").select("wilaya_code").limit(1)).error).toBeNull();
    expect((await admin.from("product_stats").select("id").limit(1)).error).toBeNull();
    expect((await admin.rpc("dashboard_stats", { p_from: DAY, p_to: DAY })).error).toBeNull();
  });

  test("kpi functions give the same numbers with p_filters null, {} and the STATS-2 figures", async () => {
    const p = await product();
    await order(p);
    await order(p, { delivery_status: "delivered" });
    const base = { p_from: DAY, p_to: DAY };
    const rates = async (f: unknown) => (await admin.rpc("kpi_set_rates", { ...base, p_product: [p], p_filters: f as never })).data;
    expect(await rates({})).toEqual(await rates(null));
    const lines = async (f: unknown) => {
      const ids = (await admin.rpc("kpi_order_set", { ...base, p_product: [p], p_filters: f as never })).data!.map((r: { id: string }) => r.id);
      return (await admin.rpc("kpi_lines", { p_order_ids: ids, p_from: DAY, p_to: DAY, p_product: [p], p_filtered: true })).data;
    };
    expect(await lines({})).toEqual(await lines(null));
    // STATS-2 figure: kpi_lines over the same ids equals kpi_rates over them
    const ids = (await admin.rpc("kpi_order_set", { ...base, p_product: [p] })).data!.map((r: { id: string }) => r.id);
    expect((await admin.rpc("kpi_rates", { p_order_ids: ids, p_from: DAY, p_to: DAY })).data).toEqual(await rates(null));
    // direct counts: two orders in the day for this product, one delivered
    const summary = (await admin.rpc("kpi_summary", { ...base, p_product: p })).data as unknown as Rates;
    expect(summary.counts).toMatchObject({ received: 2, delivered: 1 });
    const pnl = await admin.rpc("pnl_summary", { ...base, p_product: p });
    expect(pnl.error).toBeNull();
    expect(pnl.data).not.toBeNull();
    const d1 = await admin.rpc("dashboard_stats", { ...base, p_product: [p] });
    expect(d1.error).toBeNull();
    expect((d1.data as unknown as { stage_counts: { received: number } }).stage_counts.received).toBe(2);
  });

  test("drill with filters returns the same orders as a direct query (category, agent, delivery_type)", async () => {
    const cat = (await svc.from("option_sets").select("id").eq("workspace_id", ws).eq("key", "product_category").single()).data!.id;
    const opt = (await svc.from("options").select("id").eq("set_id", cat).limit(1).single()).data!.id as string;
    const pc = await product({ category_option_id: opt });
    const a = await order(pc, { assigned_confirmation_agent: agentId, delivery_type: "home" });
    await order(pc, { delivery_type: "stopdesk" });
    await order(await product(), { assigned_confirmation_agent: agentId, delivery_type: "home" });
    const drill = await admin.rpc("kpi_drill_orders", {
      p_metric: "received", p_from: DAY, p_to: DAY, p_product: [pc], p_delivery_type: "home",
      p_filters: { category: opt, agent: agentId },
    });
    const direct = await admin.from("orders").select("id").eq("product_id", pc).eq("assigned_confirmation_agent", agentId).eq("delivery_type", "home");
    expect((drill.data ?? []).map((r: { id: string }) => r.id).sort()).toEqual((direct.data ?? []).map((r: { id: string }) => r.id).sort());
    expect(drill.data!.map((r: { id: string }) => r.id)).toEqual([a]);
  });

  test("the 00061 backfill seeds only the six seasons on an existing workspace", async () => {
    const w3 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id as string;
    try {
      // a workspace with one option set but no product_category and no settings: the old backfill aborted here
      expect((await svc.from("option_sets").insert({ workspace_id: w3, key: "order_tag", label: "Tags", allows_multi: true })).error).toBeNull();
      const sql = readFileSync("supabase/migrations/00061_seasons.sql", "utf8");
      const start = sql.indexOf("insert into public.seasons (workspace_id, name, name_key, sort)\nselect w.id");
      // scoped to w3 only: the raw statement would otherwise seed every workspace, including ones other suites are deleting
      const backfill = sql.slice(start, sql.indexOf(";", start) + 1).replace("\non conflict", `\nwhere w.id = '${w3}'\non conflict`);
      expect(start).toBeGreaterThan(-1);
      psql(backfill);
      psql(backfill); // idempotent
      expect((await svc.from("seasons").select("id").eq("workspace_id", w3)).data!.length).toBe(6);
      expect((await svc.from("settings").select("key").eq("workspace_id", w3)).data).toEqual([]);
      expect((await svc.from("wilaya_fees").select("wilaya_code").eq("workspace_id", w3)).data).toEqual([]);
      expect((await svc.from("option_sets").select("key").eq("workspace_id", w3)).data!.length).toBe(1);
    } finally {
      await svc.from("seasons").delete().eq("workspace_id", w3);
      await svc.from("option_sets").delete().eq("workspace_id", w3);
      await deleteWorkspaces(svc, [w3]);
    }
  });

  test("seed_workspace twice leaves six seasons", async () => {
    const { data } = await admin.from("seasons").select("name, name_key");
    expect(data!.length).toBe(6);
    expect(data!.every((s) => s.name_key)).toBe(true);
  });

  async function season(name: string, c = admin, workspace = ws) {
    return c.from("seasons").insert({ workspace_id: workspace, name }).select("id").single();
  }

  test("admin CRUD on seasons and periods; constraints hold", async () => {
    const s = await season(tag());
    expect(s.error).toBeNull();
    const id = s.data!.id;
    const ins = await admin.from("season_periods").insert({ workspace_id: ws, season_id: id, year: 2026, date_from: "2026-02-18", date_to: "2026-03-19" });
    expect(ins.error).toBeNull();
    expect((await admin.from("season_periods").insert({ workspace_id: ws, season_id: id, year: 2026, date_from: "2026-05-01", date_to: "2026-05-02" })).error).not.toBeNull();
    expect((await admin.from("season_periods").insert({ workspace_id: ws, season_id: id, year: 2025, date_from: "2025-03-19", date_to: "2025-02-18" })).error).not.toBeNull();
    const upd = await admin.from("season_periods").update({ date_to: "2026-03-20" }).eq("season_id", id).select("id");
    expect(upd.data!.length).toBe(1);
    expect((await admin.from("seasons").update({ name: tag() }).eq("id", id).select("id")).data!.length).toBe(1);
    expect((await admin.from("seasons").delete().eq("id", id)).error).toBeNull();
    expect((await admin.from("season_periods").select("id").eq("season_id", id)).data).toEqual([]);
  });

  test("agents see nothing and cannot write; anon denied; other workspace invisible", async () => {
    const s = await season(tag());
    const id = s.data!.id;
    for (const a of [confAgent, delAgent]) {
      expect((await a.from("seasons").select("id")).data).toEqual([]);
      expect((await a.from("season_periods").select("id")).data).toEqual([]);
      expect((await season(tag(), a)).error).not.toBeNull();
      expect((await a.from("seasons").update({ name: "x" }).eq("id", id).select("id")).data).toEqual([]);
    }
    expect((await client(ANON_KEY).from("seasons").select("id")).error).not.toBeNull();
    const other = await ws2Admin.from("seasons").select("id").eq("id", id);
    expect(other.data).toEqual([]);
    expect((await ws2Admin.from("seasons").select("id")).data!.length).toBe(6);
  });

  test("a period cannot reference another workspace's season", async () => {
    const s = await season(tag());
    const r = await ws2Admin.from("season_periods").insert({ workspace_id: ws2, season_id: s.data!.id, year: 2026, date_from: "2026-01-01", date_to: "2026-01-02" });
    expect(r.error).not.toBeNull();
    const r2 = await svc.from("season_periods").insert({ workspace_id: ws2, season_id: s.data!.id, year: 2026, date_from: "2026-01-01", date_to: "2026-01-02" });
    expect(r2.error).not.toBeNull();
    // FK violation (23503), not a unique clash (23505): guards the 00062 composite unique
    expect(r2.error!.code).toBe("23503");
  });
});
