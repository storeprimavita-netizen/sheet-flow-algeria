import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Kpi } from "@/lib/kpi";

/**
 * Live P1-1 checks (migration 00031): one order set, one KPI source, money by D45.
 * Own workspace + own users, so other suites' workspace-wide sums never see these rows.
 */
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

const NONE = null as unknown as undefined; // SQL null (undefined would drop the key and miss the overload)
const DAY = "2026-03-10";
const NOON = `${DAY}T12:00:00Z`;

describe.skipIf(!URL)("KPI contract (live DB, 00031)", () => {
  let svc: SupabaseClient;
  let adminUser: SupabaseClient;
  let confAgent: SupabaseClient;
  let ws2Admin: SupabaseClient;
  let ws: string;
  let ws2: string;
  const users: string[] = [];
  const tag = () => `k-${crypto.randomUUID()}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent") {
    const email = `kpi-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }
  async function product(workspace = ws) {
    const { data, error } = await svc.from("products").insert({ workspace_id: workspace, name: tag() }).select("id").single();
    expect(error).toBeNull();
    return data!.id as string;
  }
  async function order(p: string, over: Record<string, unknown> = {}, workspace = ws) {
    const { data, error } = await svc
      .from("orders")
      .insert({ workspace_id: workspace, product_id: p, quantity: 1, sale_price: 1000, placed_at: NOON, confirmation_status: "confirmed", ...over })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }
  async function kpi(p: string, from?: string, to?: string, c = adminUser) {
    const { data, error } = await c.rpc("kpi_summary", { p_product: p, p_from: from, p_to: to });
    expect(error).toBeNull();
    return data as unknown as Kpi;
  }
  const swap = (a: string) =>
    adminUser.rpc("swap_order", {
      p_order_id: a, p_customer_id: null as unknown as string, p_customer_name: "Swap Client", p_customer_phone: "0555000111",
      p_wilaya_code: 16, p_commune: "x", p_address: "y",
    });

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    adminUser = await userIn(ws, "admin");
    confAgent = await userIn(ws, "confirmation_agent");
    ws2Admin = await userIn(ws2, "admin");
  });
  afterAll(async () => {
    if (!svc) return;
    // audited tables first: their cascade-delete audit rows would point at the vanishing workspace (FK)
    const wss = [ws, ws2].filter(Boolean);
    for (const t of ["options", "option_sets", "settings", "wilaya_fees", "fixed_fees", "exchange_rates", "expenses", "product_costs", "cash_collections", "zr_shipments", "integration_configs"] as const) {
      await svc.from(t).delete().in("workspace_id", wss);
    }
    expect((await svc.from("workspaces").delete().in("id", wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("rates ignore excluded and unconfirmed duplicates; a confirmed duplicate suspect still counts", async () => {
    const p = await product();
    for (let i = 0; i < 3; i++) await order(p);
    await order(p, { confirmation_status: "cancelled" });
    await order(p, { confirmation_status: "no_answer" });
    await order(p, { excluded_reason: "test" });
    await order(p, { confirmation_status: "wait_for_confirmation", is_duplicate_suspect: true });
    await order(p, { is_duplicate_suspect: true }); // confirmed suspect stays in
    const k = await kpi(p, DAY, DAY);
    expect(k.counts.received).toBe(6);
    expect(k.confirmation).toMatchObject({ num: 4, den: 6, matured: false });
    expect(k.confirmation.value).toBeCloseTo(4 / 6, 6);
    // money uses the same ids: same count of eligible orders in the P&L
    const { data: pnl } = await adminUser.rpc("pnl_summary", { p_from: DAY, p_to: DAY, p_product: p });
    expect((pnl as { orders_received: number }).orders_received).toBe(6);
  });

  test("dashboard_stats rates equal kpi_lines (same ids)", async () => {
    const p = await product();
    for (let i = 0; i < 4; i++) await order(p);
    await order(p, { confirmation_status: "cancelled" });
    await order(p, { delivery_status: "delivered" });
    const k = await kpi(p, DAY, DAY);
    const { data } = await adminUser.rpc("dashboard_stats", { p_from: DAY, p_to: DAY, p_product: [p] });
    const d = data as unknown as { kpi: Kpi; kpis: { confirmation_rate: number; delivery_rate: number | null } };
    expect(d.kpi.confirmation).toEqual(k.confirmation);
    expect(d.kpi.delivery).toEqual(k.delivery);
    expect(d.kpis.confirmation_rate).toBeCloseTo(100 * k.confirmation.value!, 1);
  });

  test("a swapped original is received, confirmed and one returned parcel (D47, D48); money stays clean", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returned" });
    const { data: b, error } = await swap(a);
    expect(error).toBeNull();
    await svc.from("orders").update({ delivery_status: "delivered" }).eq("id", a); // later carrier "delivered": ignored
    const before = await kpi(p);
    expect(before.counts).toMatchObject({ received: 1, confirmed: 1, delivered: 0, returned: 0, swapped: 1 });
    expect(before.confirmation).toMatchObject({ num: 1, den: 1 });
    expect(before.confirmation.of_received).toBe(1);
    expect(before.return).toMatchObject({ num: 1, den: 1 });
    expect(before.delivery).toMatchObject({ num: 0, den: 1 });
    expect(before.delivered_of_confirmed).toMatchObject({ num: 0, den: 1 });
    await svc.from("orders").update({ delivery_status: "delivered" }).eq("id", b as string);
    const after = await kpi(p);
    expect(after.counts).toMatchObject({ received: 1, confirmed: 1, delivered: 1, returned: 0 });
    expect(after.delivery).toMatchObject({ num: 1, den: 2 });
    expect(after.return).toMatchObject({ num: 1, den: 2 });
    expect(after.delivered_of_confirmed).toMatchObject({ num: 0, den: 1 }); // one set: the refused original is in the denominator, the re-shipment is not a lead
    expect(after.pnl!.return_fees).toBe(0);
    expect(after.pnl!.orders_delivered).toBe(1);
  });

  test("a swapped refusal never raises the delivery rate on the original's own day (D48 H1)", async () => {
    const p = await product();
    for (let i = 0; i < 9; i++) await order(p, { delivery_status: "delivered" });
    const a = await order(p, { delivery_status: "returned" });
    expect((await kpi(p, DAY, DAY)).delivery).toMatchObject({ num: 9, den: 10 });
    expect((await swap(a)).error).toBeNull(); // the replacement is placed today, on another day
    const day = await kpi(p, DAY, DAY);
    expect(day.delivery).toMatchObject({ num: 9, den: 10 });
    expect(day.delivery.value).toBeCloseTo(0.9, 6);
    expect(day.counts).toMatchObject({ received: 10, confirmed: 10, swapped: 1 });
    expect(day.confirmation).toMatchObject({ num: 10, den: 10 });
    expect((await kpi(p)).delivery.value).toBeLessThanOrEqual(0.9); // all-time: the replacement is still on road
    expect((await kpi(p, "2026-03-11", "2026-03-11")).counts.received).toBe(0); // replacement is no new lead
    const { data } = await adminUser.rpc("dashboard_stats", { p_from: DAY, p_to: DAY, p_product: [p] });
    expect((data as unknown as { kpis: { delivery_rate: number } }).kpis.delivery_rate).toBeCloseTo(90, 1);
  });

  test("a swapped original's failure counts under its own wilaya, not the replacement's (D48 M1)", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returned", wilaya_code: 16 });
    expect((await swap(a)).error).toBeNull(); // swap helper puts the replacement in wilaya 16: move it
    const { data: rep } = await svc.from("orders").select("id").eq("product_id", p).neq("id", a).single();
    await svc.from("orders").update({ wilaya_code: 31 }).eq("id", rep!.id);
    const stats = async (w: number) => {
      const { data } = await adminUser.rpc("dashboard_stats", { p_from: DAY, p_to: DAY, p_product: [p], p_wilaya: [w] });
      return (data as unknown as { kpi: Kpi; per_wilaya: { wilaya_code: number; delivery_rate: number | null }[] });
    };
    const w16 = await stats(16);
    expect(w16.kpi.counts).toMatchObject({ received: 1, swapped: 1 });
    expect(w16.kpi.delivery).toMatchObject({ num: 0, den: 1 });
    expect(w16.per_wilaya[0]).toMatchObject({ wilaya_code: 16, delivery_rate: 0 });
    expect((await stats(31)).kpi.counts).toMatchObject({ received: 0, swapped: 0 }); // replacement is not a lead
    const { data: byStatus } = await adminUser.rpc("dashboard_stats", {
      p_from: DAY, p_to: DAY, p_product: [p], p_delivery_status: ["swap"],
    });
    expect((byStatus as unknown as { kpi: Kpi }).kpi.counts.swapped).toBe(1);
  });

  test("Real-scenario lead count is counted in SQL, not capped at 1000 rows", async () => {
    const p = await product();
    const rows = Array.from({ length: 1005 }, () => ({
      workspace_id: ws, product_id: p, quantity: 1, sale_price: 1000, placed_at: NOON, confirmation_status: "confirmed",
    }));
    for (let i = 0; i < rows.length; i += 500) expect((await svc.from("orders").insert(rows.slice(i, i + 500))).error).toBeNull();
    expect((await kpi(p, DAY, DAY)).counts.received).toBe(1005);
  });

  test("delivery-cancelled with no shipment stays out of the denominator; with a shipment it is in", async () => {
    const p = await product();
    await order(p, { delivery_status: "delivered" });
    const c = await order(p, { delivery_status: "cancelled" });
    expect((await kpi(p, DAY, DAY)).delivery).toMatchObject({ num: 1, den: 1 });
    const ins = await svc.from("zr_shipments").insert({ order_id: c, workspace_id: ws, parcel_id: crypto.randomUUID() });
    expect(ins.error).toBeNull();
    expect((await kpi(p, DAY, DAY)).delivery).toMatchObject({ num: 1, den: 2 });
  });

  test("an order at 23:30 UTC lands on its Algiers day on every screen", async () => {
    const p = await product();
    await order(p, { placed_at: "2026-03-10T23:30:00Z" }); // 00:30 on 11 March in Algiers
    expect((await kpi(p, "2026-03-11", "2026-03-11")).counts.received).toBe(1);
    expect((await kpi(p, "2026-03-10", "2026-03-10")).counts.received).toBe(0);
    const pnl = async (d: string) =>
      ((await adminUser.rpc("pnl_summary", { p_from: d, p_to: d, p_product: p })).data as { orders_received: number }).orders_received;
    expect(await pnl("2026-03-11")).toBe(1);
    expect(await pnl("2026-03-10")).toBe(0);
    const dash = async (d: string) =>
      ((await adminUser.rpc("dashboard_stats", { p_from: d, p_to: d, p_product: [p] })).data as unknown as { stage_counts: { received: number } })
        .stage_counts.received;
    expect(await dash("2026-03-11")).toBe(1);
    expect(await dash("2026-03-10")).toBe(0);
  });

  test("on_road matches product_stock_stages.on_road on units, ignoring dates and eligibility", async () => {
    const p = await product();
    await order(p, { delivery_status: "in_transit", quantity: 3, placed_at: "2025-01-05T10:00:00Z" });
    await order(p, { delivery_status: "out_for_delivery", confirmation_status: "wait_for_confirmation", quantity: 2, excluded_reason: "test" });
    await order(p, { delivery_status: "delivered", quantity: 4 });
    const k = await kpi(p, DAY, DAY);
    const { data: st } = await adminUser.from("product_stock_stages").select("on_road").eq("product_id", p).single();
    expect(k.counts.on_road_units).toBe(st!.on_road);
    expect(k.counts.on_road_units).toBe(5);
    expect(k.counts.on_road_orders).toBe(2);
  });

  describe("money (D45)", () => {
    let p: string;
    beforeAll(async () => {
      p = await product();
      await order(p, { delivery_status: "delivered", sale_price: 5000 });
      await order(p, { delivery_status: "returned" });
      await order(p, { confirmation_status: "cancelled" });
      const cost = await svc.from("product_costs").insert({ product_id: p, workspace_id: ws, sourcing_cost: 1000 });
      expect(cost.error).toBeNull();
      expect((await svc.from("ad_spend_daily").insert({ workspace_id: ws, product_id: p, amount: 5000, spent_on: DAY })).error).toBeNull();
      expect((await svc.from("expenses").insert({ workspace_id: ws, product_id: p, category: "other", amount: 300, spent_on: DAY })).error).toBeNull();
      // a rate in force, and a future-dated one that must be ignored
      expect((await svc.from("exchange_rates").insert({ workspace_id: ws, currency: "USD", rate_dzd: 250, valid_from: "2026-01-01" })).error).toBeNull();
      expect((await svc.from("exchange_rates").insert({ workspace_id: ws, currency: "USD", rate_dzd: 1, valid_from: "2099-01-01" })).error).toBeNull();
    });

    test("ad spend USD = DZD / latest USD rate; cost per delivered in DZD and USD", async () => {
      const k = await kpi(p, DAY, DAY);
      expect(k.ad_spend_dzd).toBe(5000);
      expect(k.usd_rate).toBe(250);
      expect(k.ad_spend_usd).toBeCloseTo(20, 6);
      expect(k.cpa_delivered_dzd).toBe(5000);
      expect(k.cpa_delivered_usd).toBeCloseTo(20, 6);
      expect(k.cost_per_delivered_dzd).toBeCloseTo((5000 - k.net_profit!) / 1, 6);
      expect(k.roas).toBeCloseTo(1, 6);
    });

    test("waterfall parts sum exactly to net_profit", async () => {
      const k = await kpi(p, DAY, DAY);
      const w = k.waterfall!;
      expect(w.revenue + w.cogs + w.returns + w.ads + w.expenses_fixed).toBeCloseTo(k.net_profit!, 6);
    });

    test("USD figures are null with no rate; cost per delivered is null filtered by wilaya", async () => {
      const q = await product(ws2);
      await order(q, { delivery_status: "delivered" }, ws2);
      const k = await kpi(q, DAY, DAY, ws2Admin);
      expect(k.usd_rate).toBeNull();
      expect(k.ad_spend_usd).toBeNull();
      const { data } = await adminUser.rpc("dashboard_stats", { p_from: DAY, p_to: DAY, p_product: [p], p_wilaya: [16] });
      expect((data as unknown as { kpi: Kpi }).kpi.cost_per_delivered_dzd).toBeNull();
      expect((await kpi(p, DAY, DAY)).cost_per_delivered_dzd).not.toBeNull();
    });

    test("an agent gets rates, no money keys, null usd_rate", async () => {
      const k = (await kpi(p, DAY, DAY, confAgent)) as Record<string, unknown>;
      expect(k.confirmation).toBeDefined();
      expect(k.usd_rate).toBeNull();
      for (const key of ["pnl", "ad_spend_dzd", "ad_spend_usd", "roas", "net_profit", "waterfall", "cpa_delivered_dzd", "cost_per_delivered_dzd"]) {
        expect(key in k, key).toBe(false);
      }
    });
  });

  describe("matured, return, of_received (review 1)", () => {
    const wilayaRow = async (c: SupabaseClient, p: string) => {
      const { data } = await c.rpc("dashboard_stats", { p_product: [p] });
      return (data as unknown as { per_wilaya: { wilaya_code: number; stop_shipping_auto: boolean }[] }).per_wilaya.find((w) => w.wilaya_code === 31);
    };

    test("orders waiting for pickup keep delivery unmatured and stop_shipping_auto off", async () => {
      const p = await product();
      for (let i = 0; i < 10; i++) await order(p, { delivery_status: "returned", wilaya_code: 31 });
      for (let i = 0; i < 40; i++) await order(p, { delivery_status: "wait_for_deposit", wilaya_code: 31 });
      const k = await kpi(p, DAY, DAY);
      expect(k.delivery).toMatchObject({ den: 10, value: 0, matured: false });
      expect(k.return).toMatchObject({ num: 10, den: 10, matured: false });
      expect((await wilayaRow(adminUser, p))?.stop_shipping_auto).toBe(false);
    });

    test("a resolved cohort is matured: stop_shipping_auto on, return value and of_received", async () => {
      const p = await product();
      for (let i = 0; i < 10; i++) await order(p, { delivery_status: "returned", wilaya_code: 31 });
      await order(p, { confirmation_status: "cancelled", wilaya_code: 31 });
      await order(p, { confirmation_status: "wait_for_confirmation", wilaya_code: 31 });
      const k = await kpi(p, DAY, DAY);
      expect(k.delivery).toMatchObject({ den: 10, value: 0, matured: true });
      expect(k.return.value).toBe(1);
      expect(k.counts.in_flight).toBe(0);
      expect(k.confirmation.of_received).toBeCloseTo(10 / 12, 6);
      expect((await wilayaRow(adminUser, p))?.stop_shipping_auto).toBe(true);
    });

    test("in_flight counts parcels after pickup", async () => {
      const p = await product();
      await order(p, { delivery_status: "in_transit" });
      await order(p, { delivery_status: "wait_for_deposit" });
      expect((await kpi(p, DAY, DAY)).counts.in_flight).toBe(1);
    });
  });

  describe("money ids and roles (review 1)", () => {
    test("revenue includes a delivered, confirmed duplicate suspect", async () => {
      const p = await product();
      await order(p, { delivery_status: "delivered", sale_price: 700 });
      await order(p, { delivery_status: "delivered", sale_price: 300, is_duplicate_suspect: true });
      await order(p, { delivery_status: "delivered", sale_price: 9000, excluded_reason: "fake" });
      const k = await kpi(p, DAY, DAY);
      expect(k.counts.delivered).toBe(2);
      expect(k.pnl!.revenue).toBe(1000);
    });

    test("order ids of another workspace give no revenue or P&L", async () => {
      const p = await product();
      const id = await order(p, { delivery_status: "delivered" });
      const { data } = await ws2Admin.rpc("kpi_lines", { p_order_ids: [id], p_from: NONE, p_to: NONE, p_product: NONE, p_filtered: false });
      const k = data as unknown as Kpi;
      expect(k.pnl!.revenue).toBe(0);
      expect(k.pnl!.orders_received).toBe(0);
      expect(k.counts.delivered).toBe(0);
    });

    test("an agent calling dashboard_stats gets kpi without money keys and pnl null; same for pnl_by_product", async () => {
      const p = await product();
      await order(p, { delivery_status: "delivered" });
      const { data } = await confAgent.rpc("dashboard_stats", { p_product: [p] });
      const d = data as unknown as { kpi: Record<string, unknown>; pnl: unknown };
      expect(d.pnl).toBeNull();
      expect(d.kpi.confirmation).toBeDefined();
      for (const key of ["pnl", "ad_spend_dzd", "roas", "net_profit", "waterfall"]) expect(key in d.kpi, key).toBe(false);
      const { data: rows } = await confAgent.rpc("pnl_by_product", {});
      for (const r of rows ?? []) {
        expect(r.pnl).toBeNull();
        for (const key of ["ad_spend_dzd", "roas", "net_profit", "waterfall"]) expect(key in (r.kpi as object), key).toBe(false);
      }
    });
  });

  describe("walls", () => {
    test("anon cannot execute kpi_rates / kpi_metric / pnl_by_product", async () => {
      const anon = client(ANON_KEY);
      expect((await anon.rpc("kpi_rates", { p_order_ids: [] })).error).not.toBeNull();
      expect((await anon.rpc("kpi_metric", { p_num: 1, p_den: 2, p_unresolved: 0 })).error).not.toBeNull();
      expect((await anon.rpc("pnl_by_product", {})).error).not.toBeNull();
    });

    test("order ids of another workspace return 0", async () => {
      const p = await product();
      const id = await order(p);
      const { data, error } = await ws2Admin.rpc("kpi_lines", { p_order_ids: [id], p_from: NONE, p_to: NONE, p_product: NONE, p_filtered: false });
      expect(error).toBeNull();
      expect((data as unknown as Kpi).counts.received).toBe(0);
    });

    test("anon cannot execute kpi_lines / kpi_summary / kpi_order_set", async () => {
      const anon = client(ANON_KEY);
      expect((await anon.rpc("kpi_lines", { p_order_ids: [], p_from: NONE, p_to: NONE, p_product: NONE, p_filtered: false })).error).not.toBeNull();
      expect((await anon.rpc("kpi_summary", {})).error).not.toBeNull();
      expect((await anon.rpc("kpi_order_set", {})).error).not.toBeNull();
    });

    test("replaced views keep security_invoker; anon reads return nothing", async () => {
      const out = psql(
        "select relname || '=' || coalesce(array_to_string(reloptions, ','), '') from pg_class where relname in ('product_stats','wilaya_stats','product_stock_v') order by 1;",
      );
      for (const v of ["product_stats", "wilaya_stats", "product_stock_v"]) expect(out).toContain(`${v}=security_invoker=true`);
      const anon = client(ANON_KEY);
      for (const v of ["product_stats", "wilaya_stats", "product_stock_v"] as const) {
        const { data, error } = await anon.from(v).select("*");
        expect(error ? [] : data).toEqual([]);
      }
    });

    test("product_stock_v: admin sees rows, an agent sees none; anon cannot write", async () => {
      const p = await product();
      const { data: adm } = await adminUser.from("product_stock_v").select("*").eq("product_id", p);
      expect(adm).toHaveLength(1);
      expect(adm![0]).toMatchObject({ sellable: 0, low: true });
      const { data: ag } = await confAgent.from("product_stock_v").select("*");
      expect(ag ?? []).toEqual([]);
      expect((await client(ANON_KEY).from("product_stock_v").insert({ product_id: p } as never)).error).not.toBeNull();
    });
  });
});
