import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteLeakedWorkspaces, deleteWorkspaces } from "@/lib/test-cleanup";

/** Live CHART-1 checks (migration 00078): admin-only series, money = pnl_lines, Algiers days, rates via kpi_rates. */
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
    input: sql, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  });
const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(email: string) {
  const c = client(ANON_KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}

type Rates = { counts: { received: number; confirmed: number; delivered: number; returned: number; swapped: number } };
type Money = { revenue: number; cogs: number; return_fees: number; ad_spend: number; expenses: number; fixed: number; costs: number; net_profit: number };
type Day = { day: string; rates: Rates; money: Money | null; immature: boolean };

const FROM = "2026-03-10";
const TO = "2026-03-16";
const RPCS = ["kpi_daily", "kpi_by_weekday_hour", "kpi_by_product", "kpi_outcomes"] as const;

describe.skipIf(!URL)("chart series (live DB, 00078)", () => {
  let svc: SupabaseClient;
  let admin: SupabaseClient;
  let agent: SupabaseClient;
  let ws: string;
  let p1: string;
  let p2: string;
  const users: string[] = [];
  const tag = () => `cs-${crypto.randomUUID()}`;

  async function userIn(role: "admin" | "confirmation_agent") {
    const email = `cs-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: ws, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }
  async function order(p: string, placed: string, over: Record<string, unknown> = {}) {
    const { data, error } = await svc
      .from("orders")
      .insert({ workspace_id: ws, product_id: p, quantity: 1, sale_price: 1000, placed_at: placed, confirmation_status: "confirmed", wilaya_code: 16, commune: "Bab Ezzouar", ...over })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }
  const daily = async (args: Record<string, unknown>, c = admin) => {
    const { data, error } = await c.rpc("kpi_daily", args as never);
    expect(error).toBeNull();
    return (data ?? []) as unknown as Day[];
  };
  const sum = (rows: Day[], k: keyof Money) => rows.reduce((s, r) => s + (r.money?.[k] ?? 0), 0);
  const pnl = async (args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc("pnl_summary", args as never);
    expect(error).toBeNull();
    return data as unknown as Record<string, number>;
  };

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    await deleteLeakedWorkspaces(svc, "cs-");
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    admin = await userIn("admin");
    agent = await userIn("confirmation_agent");
    psql(`select public.seed_workspace('${ws}');`);
    p1 = (await svc.from("products").insert({ workspace_id: ws, name: tag() }).select("id").single()).data!.id;
    p2 = (await svc.from("products").insert({ workspace_id: ws, name: tag() }).select("id").single()).data!.id;
    await svc.from("product_costs").upsert([
      { product_id: p1, workspace_id: ws, sourcing_cost: 300 },
      { product_id: p2, workspace_id: ws, sourcing_cost: 450 },
    ]);
    // delivered p1 on the 10th, delivered p2 on the 12th, returned p1 on the 12th
    await order(p1, "2026-03-10T12:00:00Z", { delivery_status: "delivered" });
    await order(p2, "2026-03-12T12:00:00Z", { delivery_status: "delivered", sale_price: 2500, quantity: 2 });
    await order(p1, "2026-03-12T13:00:00Z", { delivery_status: "returned" });
    // 23:30 UTC on the 14th is 00:30 on the 15th in Algiers (UTC+1)
    await order(p1, "2026-03-14T23:30:00Z", { confirmation_status: "wait_for_confirmation" });
    // swap: original (swapped_to) on the 11th, replacement on the 13th
    const repl = await order(p2, "2026-03-13T10:00:00Z", { delivery_status: "delivered" });
    const orig = await order(p2, "2026-03-11T10:00:00Z", { delivery_status: "returned" });
    psql(`begin; set local mnw.swap_link = '1'; update public.orders set swapped_to_order_id = '${repl}' where id = '${orig}'; commit;`);
    await order(p1, "2026-03-16T10:00:00Z", { confirmation_status: "cancelled" });
    expect((await svc.from("fixed_fees").insert({ workspace_id: ws, label: "rent", amount: 10000 })).error).toBeNull();
    expect((await svc.from("ad_spend_daily").insert({ workspace_id: ws, product_id: p1, spent_on: "2026-03-11", kind: "test", amount: 20, currency: "DZD", fx_rate: 1 })).error).toBeNull();
    expect((await svc.from("ad_spend_daily").insert({ workspace_id: ws, product_id: p2, spent_on: "2026-03-14", kind: "scaling", amount: 35.5, currency: "DZD", fx_rate: 1 })).error).toBeNull();
    expect((await svc.from("expenses").insert({ workspace_id: ws, product_id: p1, category: "other", amount: 77.7, spent_on: "2026-03-13" })).error).toBeNull();
  }, 40000);
  afterAll(async () => {
    if (!svc) return;
    // audited tables first: their cascade delete would audit a workspace that is already gone
    for (const t of ["fixed_fees", "ad_spend_daily", "expenses", "product_costs", "products", "options", "option_sets", "settings", "wilaya_fees"])
      await svc.from(t).delete().eq("workspace_id", ws);
    expect((await deleteWorkspaces(svc, [ws])).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("agent gets nothing from every RPC; anon is denied", async () => {
    const anon = client(ANON_KEY);
    for (const fn of RPCS) {
      const a = await agent.rpc(fn, { p_from: FROM, p_to: TO });
      expect(a.error).toBeNull();
      expect(a.data).toEqual([]);
      expect((await anon.rpc(fn, {})).error).not.toBeNull();
    }
  });

  test("daily money sums to pnl_lines exactly: 7 days, 10000/month fixed fees", async () => {
    const rows = await daily({ p_from: FROM, p_to: TO });
    expect(rows).toHaveLength(7);
    const p = await pnl({ p_from: FROM, p_to: TO });
    expect(p.fixed_fees).toBe(2333.33);
    for (const [k, pk] of [["revenue", "revenue"], ["cogs", "cogs"], ["return_fees", "return_fees"], ["ad_spend", "ad_spend"], ["expenses", "expenses"], ["fixed", "fixed_fees"], ["net_profit", "net_profit"]] as const)
      expect(sum(rows, k)).toBeCloseTo(p[pk], 2);
    for (const r of rows) expect(r.money!.net_profit).toBeCloseTo(r.money!.revenue - r.money!.costs, 2);
  });

  test("no dates: same bounds as pnl_lines, same sums", async () => {
    const rows = await daily({});
    const p = await pnl({});
    expect(rows[0].day).toBe(FROM);
    expect(sum(rows, "revenue")).toBeCloseTo(p.revenue, 2);
    expect(sum(rows, "fixed")).toBeCloseTo(p.fixed_fees, 2);
    expect(sum(rows, "net_profit")).toBeCloseTo(p.net_profit, 2);
  }, 30000);

  test("no dates with a future-dated order: the days still sum to the period total", async () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    const id = await order(p1, future, { delivery_status: "delivered" });
    try {
      const rows = await daily({});
      const p = await pnl({});
      expect(rows.some((r) => r.day > new Date().toISOString().slice(0, 10))).toBe(true);
      for (const [k, pk] of [["revenue", "revenue"], ["fixed", "fixed_fees"], ["net_profit", "net_profit"]] as const) expect(sum(rows, k)).toBeCloseTo(p[pk], 2);
    } finally {
      await svc.from("orders").delete().eq("id", id);
    }
  }, 30000);

  test("product filter: fixed fees follow the delivered share, sums still match", async () => {
    const rows = await daily({ p_from: FROM, p_to: TO, p_product: [p1] });
    const p = await pnl({ p_from: FROM, p_to: TO, p_product: p1 });
    expect(p.fixed_share).toBeLessThan(1);
    expect(sum(rows, "fixed")).toBeCloseTo(p.fixed_fees, 2);
    expect(sum(rows, "ad_spend")).toBeCloseTo(p.ad_spend, 2);
    expect(sum(rows, "net_profit")).toBeCloseTo(p.net_profit, 2);
  });

  test("a non-product filter omits the money keys", async () => {
    const rows = await daily({ p_from: FROM, p_to: TO, p_filters: { wilaya: "16" } });
    expect(rows.length).toBe(7);
    expect(rows.every((r) => r.money === null)).toBe(true);
  });

  test("p_from after p_to is rejected", async () => {
    const { error } = await admin.rpc("kpi_daily", { p_from: TO, p_to: FROM });
    expect(error).not.toBeNull();
  });

  test("p_from after p_to is rejected by every chart RPC", async () => {
    for (const fn of RPCS) {
      const { error } = await admin.rpc(fn, { p_from: TO, p_to: FROM });
      expect(error, fn).not.toBeNull();
    }
  });

  test("a range over 366 days: daily is the last 366 days and sums to pnl_lines of that window", async () => {
    const rows = await daily({ p_from: "2024-01-01", p_to: TO });
    expect(rows).toHaveLength(366);
    const p = await pnl({ p_from: rows[0].day, p_to: TO });
    for (const [k, pk] of [["revenue", "revenue"], ["cogs", "cogs"], ["fixed", "fixed_fees"], ["net_profit", "net_profit"]] as const)
      expect(sum(rows, k)).toBeCloseTo(p[pk], 2);
    for (const r of rows) expect(r.money!.fixed).toBeGreaterThanOrEqual(0);
  });

  test("a far-future order: the ordered, limited kpi_daily is 366 days ending on its day", async () => {
    const id = await order(p1, "2099-06-01T10:00:00+01:00");
    try {
      const { data, error } = await admin.rpc("kpi_daily", { p_from: FROM, p_to: "2099-06-30" }).order("day", { ascending: false }).limit(366);
      expect(error).toBeNull();
      const rows = (data ?? []) as unknown as Day[];
      expect(rows).toHaveLength(366);
      expect(rows[0].day).toBe("2099-06-01");
    } finally {
      await svc.from("orders").delete().eq("id", id);
    }
  }, 60000);

  test("outcome drills list exactly the orders each outcome counts", async () => {
    const { data } = await admin.rpc("kpi_outcomes", { p_from: FROM, p_to: TO });
    for (const o of data as unknown as { outcome: string; n: number }[]) {
      const { data: d, error } = await admin.rpc("kpi_drill_orders", { p_metric: `out_${o.outcome}`, p_from: FROM, p_to: TO, p_limit: 1 });
      expect(error).toBeNull();
      expect(Number((d as { total: number }[])[0]?.total ?? 0), o.outcome).toBe(o.n);
    }
  });

  test("daily counts re-aggregate to kpi_rates; swaps and replacements do not shift them", async () => {
    const rows = await daily({ p_from: FROM, p_to: TO });
    const { data } = await admin.rpc("kpi_set_rates", { p_from: FROM, p_to: TO });
    const whole = (data as unknown as Rates).counts;
    for (const k of ["received", "confirmed", "delivered", "returned", "swapped"] as const)
      expect(rows.reduce((s, r) => s + r.rates.counts[k], 0)).toBe(whole[k]);
    expect(whole.swapped).toBe(1);
    // 7 orders, one is a replacement (not "received")
    expect(whole.received).toBe(6);
  });

  test("23:30 UTC lands on the next Algiers day, hour 0, Sunday (ISO 7)", async () => {
    const rows = await daily({ p_from: "2026-03-14", p_to: "2026-03-15" });
    expect(rows[0].rates.counts.received).toBe(0);
    expect(rows[1].day).toBe("2026-03-15");
    expect(rows[1].rates.counts.received).toBe(1);
    const { data, error } = await admin.rpc("kpi_by_weekday_hour", { p_from: "2026-03-14", p_to: "2026-03-15" });
    expect(error).toBeNull();
    const rows2 = data as unknown as { kind: string; bucket: number; rates: Rates }[];
    expect(rows2.find((r) => r.kind === "hour" && r.bucket === 0)?.rates.counts.received).toBe(1);
    expect(rows2.find((r) => r.kind === "weekday" && r.bucket === 7)?.rates.counts.received).toBe(1);
    expect(rows2.some((r) => r.kind === "hour" && r.bucket === 23)).toBe(false);
  });

  test("outcome split adds up to received, at most 5 categories", async () => {
    const { data, error } = await admin.rpc("kpi_outcomes", { p_from: FROM, p_to: TO });
    expect(error).toBeNull();
    const rows = data as unknown as { outcome: string; n: number }[];
    expect(rows.length).toBeLessThanOrEqual(5);
    const { data: r } = await admin.rpc("kpi_set_rates", { p_from: FROM, p_to: TO });
    expect(rows.reduce((s, x) => s + x.n, 0)).toBe((r as unknown as Rates).counts.received);
  });

  test("kpi_by_product groups the same set; product filter narrows it", async () => {
    const { data } = await admin.rpc("kpi_by_product", { p_from: FROM, p_to: TO });
    const rows = data as unknown as { product_id: string; rates: Rates }[];
    expect(rows.map((r) => r.product_id).sort()).toEqual([p1, p2].sort());
    const one = await admin.rpc("kpi_by_product", { p_from: FROM, p_to: TO, p_product: [p1] });
    expect((one.data as unknown[]).length).toBe(1);
  });

  test("dashboard_stats no longer carries a daily series", async () => {
    const { data, error } = await admin.rpc("dashboard_stats", { p_from: FROM, p_to: TO });
    expect(error).toBeNull();
    expect(Object.keys(data as object)).not.toContain("daily");
    expect(Object.keys(data as object)).toContain("kpi");
  });
});
