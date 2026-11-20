import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteWorkspaces } from "@/lib/test-cleanup";

/** 00029's own loop, scoped to one workspace: the unscoped file scans every order and deadlocks (40P01) with parallel suites. */
const reconcileWs = (workspace: string) => {
  const sql = readFileSync("supabase/migrations/00029_stock_reconcile_existing.sql", "utf8");
  const scoped = sql.replace("where product_id is not null loop", `where product_id is not null and workspace_id = '${workspace}' loop`);
  if (scoped === sql) throw new Error("00029 loop select changed; update reconcileWs");
  return scoped;
};

/** Live P0-8 checks: stock in three stages (D34), add-only log (D35), workspace guard (D30), swap link (D31). */
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

const STATUSES = [
  "wait_for_deposit", "bureau_deposited", "in_transit", "out_for_delivery", "stop_desk_waiting",
  "delivered", "cancelled", "delayed", "returning", "returned", "exchange", "swap",
] as const;
const ON_CARRIER = ["bureau_deposited", "in_transit", "out_for_delivery", "stop_desk_waiting", "delayed", "returning", "exchange", "delivered"];

const client = (key: string) => createClient(URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
async function signIn(email: string) {
  const c = client(ANON_KEY);
  const { error } = await c.auth.signInWithPassword({ email, password: SEED_PASSWORD });
  if (error) throw new Error(`sign in ${email}: ${error.message}`);
  return c;
}

describe.skipIf(!URL)("stock in three stages (live DB)", () => {
  let svc: SupabaseClient;
  let adminUser: SupabaseClient;
  let confAgent: SupabaseClient;
  let delivAgent: SupabaseClient;
  let ws: string; // the seed admin's workspace
  let ws2: string; // a second workspace
  const products: string[] = [];
  const tag = () => `t-${crypto.randomUUID()}`;

  async function product(workspace = ws) {
    const { data, error } = await svc.from("products").insert({ workspace_id: workspace, name: tag() }).select("id").single();
    expect(error).toBeNull();
    if (workspace === ws) products.push(data!.id);
    return data!.id as string;
  }
  async function order(productId: string | null, over: Record<string, unknown> = {}, workspace = ws) {
    const { data, error } = await svc
      .from("orders")
      .insert({ workspace_id: workspace, product_id: productId, quantity: 2, confirmation_status: "confirmed", ...over })
      .select("id")
      .single();
    expect(error).toBeNull();
    return data!.id as string;
  }
  const status = async (id: string, delivery_status: string) => {
    const { error } = await svc.from("orders").update({ delivery_status }).eq("id", id);
    expect(error).toBeNull();
  };
  const stock = async (p: string) => (await svc.from("products").select("stock").eq("id", p).single()).data!.stock as number;
  const moves = async (id: string) =>
    ((await svc.from("stock_movements").select("delta, reason").eq("order_id", id).order("created_at")).data ?? []) as { delta: number; reason: string }[];
  const held = async (id: string) => (await moves(id)).reduce((s, m) => s - m.delta, 0);
  const stages = async (p: string) => (await adminUser.from("product_stock_stages").select("*").eq("product_id", p).single()).data!;
  const swap = (a: string, customer: string | null = null, c = adminUser) =>
    c.rpc("swap_order", {
      p_order_id: a, p_customer_id: customer as string, p_customer_name: "Swap Client", p_customer_phone: "0555000111",
      p_wilaya_code: 16, p_commune: "x", p_address: "y",
    });
  async function customer(workspace = ws) {
    const phone = "05" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
    const { data, error } = await svc.from("customers").insert({ workspace_id: workspace, name: tag(), phone }).select("id").single();
    expect(error).toBeNull();
    return data!.id as string;
  }

  const users: string[] = [];
  // Own workspace + own users: other suites compute workspace-wide sums (pnl) and must not see these orders.
  async function userIn(workspace: string, role: "admin" | "confirmation_agent" | "delivery_agent") {
    const email = `p08-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    adminUser = await userIn(ws, "admin");
    confAgent = await userIn(ws, "confirmation_agent");
    delivAgent = await userIn(ws, "delivery_agent");
  });
  afterAll(async () => {
    if (!svc) return;
    // add-only log: deleting the workspaces cascades orders, products and their movements
    // audited tables first: their cascade-delete audit rows would point at the vanishing workspace (FK)
    const wss = [ws, ws2].filter(Boolean);
    for (const t of ["options", "option_sets", "settings", "wilaya_fees", "fixed_fees", "exchange_rates", "expenses", "product_costs", "cash_collections", "zr_shipments", "integration_configs"] as const) {
      await svc.from(t).delete().in("workspace_id", wss);
    }
    expect((await deleteWorkspaces(svc, wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("confirm only keeps stock and shows reserved", async () => {
    const p = await product();
    await svc.from("stock_movements").insert({ workspace_id: ws, product_id: p, delta: 10, reason: "purchase" });
    await order(p);
    expect(await stock(p)).toBe(10);
    expect(await stages(p)).toMatchObject({ in_stock: 10, reserved: 2, on_road: 0, delivered: 0 });
  });

  test("deposit moves the piece on road, delivered stays out, returned restores, reshipped re-deducts", async () => {
    const p = await product();
    await svc.from("stock_movements").insert({ workspace_id: ws, product_id: p, delta: 10, reason: "purchase" });
    const o = await order(p);
    await status(o, "bureau_deposited");
    expect(await stock(p)).toBe(8);
    expect(await stages(p)).toMatchObject({ in_stock: 8, reserved: 0, on_road: 2, delivered: 0 });
    await status(o, "delivered");
    expect(await stock(p)).toBe(8);
    expect(await stages(p)).toMatchObject({ on_road: 0, delivered: 2 });
    await status(o, "returned");
    expect(await stock(p)).toBe(10);
    await status(o, "in_transit");
    expect(await stock(p)).toBe(8);
    expect((await moves(o)).map((m) => m.reason)).toEqual(["order_shipped", "order_returned", "order_shipped"]);
    await status(o, "cancelled");
    expect(await stock(p)).toBe(10);
  });

  test.each(STATUSES.filter((x) => x !== "swap"))("trigger target equals the view bucket: %s", async (st) => {
    const p = await product();
    const o = await order(p, { delivery_status: st }); // inserted already in that status
    const s = await stages(p);
    const expected = ON_CARRIER.includes(st) ? 2 : 0;
    expect(await held(o)).toBe(expected);
    expect(s.on_road + s.delivered).toBe(expected);
    expect(await stock(p)).toBe(0 - expected);
    expect(s.delivered).toBe(st === "delivered" ? 2 : 0);
  });

  test("repeated identical update writes no movement; quantity change while on road adjusts the difference", async () => {
    const p = await product();
    const o = await order(p, { delivery_status: "in_transit" });
    await status(o, "in_transit");
    await svc.from("orders").update({ quantity: 2 }).eq("id", o);
    expect(await moves(o)).toHaveLength(1);
    await svc.from("orders").update({ quantity: 5 }).eq("id", o);
    expect(await held(o)).toBe(5);
    expect(await stock(p)).toBe(-5);
    expect((await moves(o)).at(-1)).toEqual({ delta: -3, reason: "order_stock_sync" });
  });

  test("product change moves stock; product_id null on road releases it", async () => {
    const p1 = await product();
    const p2 = await product();
    const o = await order(p1, { delivery_status: "in_transit" });
    await svc.from("orders").update({ product_id: p2 }).eq("id", o);
    expect(await stock(p1)).toBe(0);
    expect(await stock(p2)).toBe(-2);
    await svc.from("orders").update({ product_id: null }).eq("id", o);
    expect(await stock(p2)).toBe(0);
  });

  test("legacy order_reverted row is counted in current; reconcile is idempotent", async () => {
    const p = await product();
    const o = await order(p, { delivery_status: "in_transit" }); // -2
    await svc.from("stock_movements").insert({ workspace_id: ws, product_id: p, delta: 2, reason: "order_reverted", order_id: o });
    expect(await stock(p)).toBe(0);
    await status(o, "delivered"); // current 0, target -2 -> one -2 movement
    expect(await stock(p)).toBe(-2);
    const n = (await moves(o)).length;
    await status(o, "delivered");
    expect((await moves(o)).length).toBe(n);
  });

  test("linked swap original follows status changes without moving stock", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    expect(await stock(p)).toBe(-1);
    const { data: b, error } = await swap(a);
    expect(error).toBeNull();
    expect(await held(a)).toBe(0);
    expect(await held(b as string)).toBe(1);
    expect(await stock(p)).toBe(-1);
    expect(await stages(p)).toMatchObject({ reserved: 0, on_road: 1, delivered: 0 });
    const n = (await moves(a)).length;
    await status(a, "returning");
    await status(a, "delivered"); // what apply_zr_state does to a swapped original
    expect((await svc.from("orders").select("delivery_status").eq("id", a).single()).data!.delivery_status).toBe("delivered");
    expect((await moves(a)).length).toBe(n);
    expect(await held(a)).toBe(0);
    expect(await stock(p)).toBe(-1);
    await status(a, "returning");
    // deleting B unlinks A (FK) and releases B's piece; A reconciles by its status (returning = on carrier)
    expect((await svc.from("orders").delete().eq("id", b as string)).error).toBeNull();
    expect(await held(a)).toBe(1);
    expect(await stock(p)).toBe(-1);
  });

  test("swap_order: double submit via Promise.all creates one B", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returned", quantity: 1 });
    const [r1, r2] = await Promise.all([swap(a), swap(a)]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect(r1.data).toBe(r2.data);
    const { count } = await svc.from("orders").select("id", { count: "exact", head: true }).eq("product_id", p);
    expect(count).toBe(2);
  });

  test("swap_order refused: non-admin, disallowed status, other-workspace customer, order without product", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returned", quantity: 1 });
    expect((await swap(a, null, confAgent)).error?.message).toMatch(/admin only/);
    const early = await order(p, { delivery_status: "in_transit", quantity: 1 });
    expect((await swap(early)).error?.message).toMatch(/not allowed/);
    expect((await swap(a, await customer(ws2))).error?.message).toMatch(/customer/);
    const none = await order(null, { delivery_status: "returned" });
    expect((await swap(none)).error?.message).toMatch(/no product/);
    expect((await svc.from("orders").select("swapped_to_order_id").eq("id", a).single()).data!.swapped_to_order_id).toBeNull();
  });

  test("add-only: update/delete refused for admin and service role; hand-inserted order_* refused", async () => {
    const p = await product();
    const o = await order(p, { delivery_status: "in_transit" });
    const [m] = (await svc.from("stock_movements").select("id").eq("order_id", o)).data!;
    for (const c of [svc, adminUser]) {
      expect((await c.from("stock_movements").update({ note: "x" }).eq("id", m.id)).error).not.toBeNull();
      expect((await c.from("stock_movements").delete().eq("id", m.id)).error).not.toBeNull();
    }
    expect((await adminUser.from("stock_movements").insert({ workspace_id: ws, product_id: p, delta: 1, reason: "order_shipped" })).error).not.toBeNull();
    expect((await adminUser.from("stock_movements").insert({ workspace_id: ws, product_id: p, delta: 1, reason: "correction", order_id: o })).error).not.toBeNull();
    expect((await adminUser.from("stock_movements").insert({ workspace_id: ws, product_id: p, delta: 3, reason: "correction" })).error).toBeNull();
  });

  test("deleting an order (D41): pre-pickup releases, on road and delivered keep pieces out; deleting a workspace succeeds", async () => {
    const p = await product();
    const wait = await order(p, { delivery_status: "wait_for_deposit" });
    const road = await order(p, { delivery_status: "in_transit" });
    const done = await order(p, { delivery_status: "delivered" });
    expect(await stock(p)).toBe(-4);
    expect((await svc.from("orders").delete().eq("id", wait)).error).toBeNull();
    expect((await svc.from("orders").delete().eq("id", road)).error).toBeNull();
    expect((await svc.from("orders").delete().eq("id", done)).error).toBeNull();
    expect(await stock(p)).toBe(-4);
    // old-rule reservation on a cancelled order is cleared
    const c = await order(p, { delivery_status: "in_transit" });
    await status(c, "cancelled");
    expect(await held(c)).toBe(0);

    const w = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    const wp = await product(w);
    await order(wp, { delivery_status: "delivered" }, w);
    expect((await deleteWorkspaces(svc, [w])).error).toBeNull();
  });

  test("deleting a swap original reconciles its replacement (review-5 #2)", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    const { data: b } = await swap(a);
    await status(b as string, "wait_for_deposit"); // already; B holds -1 as a replacement
    expect(await held(b as string)).toBe(1);
    expect((await svc.from("orders").delete().eq("id", a)).error).toBeNull();
    expect(await held(b as string)).toBe(0);
    expect(await stock(p)).toBe(0);
  });

  test("swap link across workspaces is refused (review-5 #1, D30)", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "in_transit" });
    const other = await order(null, {}, ws2);
    const { error } = await adminUser.from("orders").update({ swapped_to_order_id: other }).eq("id", a);
    expect(error?.message).toMatch(/swap link is written only by swap_order/); // D42 refuses before the workspace check
    expect((await svc.from("orders").update({ swapped_to_order_id: other }).eq("id", a)).error).not.toBeNull();
  });

  test("products.stock changes only through a movement (review-5 #4)", async () => {
    const p = await product();
    expect((await adminUser.from("products").update({ stock: 99 }).eq("id", p)).error).not.toBeNull();
    expect((await svc.from("products").update({ stock: 99 }).eq("id", p)).error).not.toBeNull();
    expect(await stock(p)).toBe(0);
    expect((await adminUser.from("stock_movements").insert({ workspace_id: ws, product_id: p, delta: 5, reason: "purchase" })).error).toBeNull();
    expect(await stock(p)).toBe(5);
  });

  test("a product with movements deletes only after its orders", async () => {
    const p = await product();
    const o = await order(p, { delivery_status: "in_transit" });
    expect((await svc.from("products").delete().eq("id", p)).error).not.toBeNull();
    await svc.from("orders").delete().eq("id", o);
    expect((await svc.from("products").delete().eq("id", p)).error).toBeNull();
  });

  test("workspace guard: movement across workspaces and order with another workspace's product are refused", async () => {
    const p = await product();
    expect((await svc.from("stock_movements").insert({ workspace_id: ws2, product_id: p, delta: 1, reason: "purchase" })).error).not.toBeNull();
    const { error } = await svc.from("orders").insert({ workspace_id: ws2, product_id: p, quantity: 1 });
    expect(error).not.toBeNull();
  });

  test("delivery and confirmation agents read 0 rows from the view and the log", async () => {
    const p = await product();
    await order(p, { delivery_status: "in_transit" });
    for (const c of [confAgent, delivAgent]) {
      expect((await c.from("product_stock_stages").select("product_id").eq("product_id", p)).data).toHaveLength(0);
      expect((await c.from("stock_movements").select("id").eq("product_id", p)).data).toHaveLength(0);
    }
  });

  test("00029 reconcile is idempotent: a second run writes nothing", async () => {
    const count = async () => (await svc.from("stock_movements").select("id", { count: "exact", head: true }).in("product_id", products)).count; // own products only: other suites run in parallel
    const p = await product();
    await order(p, { delivery_status: "in_transit" });
    const before = await count();
    psql(reconcileWs(ws));
    expect(await count()).toBe(before);
  });

  test("only swap_order writes the link (D42): insert linked, direct link, re-point all refused", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    const { data: b } = await swap(a);
    const other = await order(p, { delivery_status: "in_transit", quantity: 1 });
    const fresh = await order(p, { delivery_status: "wait_for_deposit", quantity: 1 });
    const refuse = /swap link is written only by swap_order/;
    // inserted already linked
    for (const c of [svc, adminUser]) {
      const { error } = await c.from("orders").insert({ workspace_id: ws, product_id: p, quantity: 1, swapped_to_order_id: fresh });
      expect(error?.message).toMatch(refuse);
    }
    // direct link from empty, a second original on the same replacement, re-point, clear
    for (const c of [svc, adminUser]) {
      expect((await c.from("orders").update({ swapped_to_order_id: fresh }).eq("id", other)).error?.message).toMatch(refuse);
      expect((await c.from("orders").update({ swapped_to_order_id: b as string }).eq("id", other)).error?.message).toMatch(refuse);
      expect((await c.from("orders").update({ swapped_to_order_id: fresh }).eq("id", a)).error?.message).toMatch(refuse);
      expect((await c.from("orders").update({ swapped_to_order_id: null }).eq("id", a)).error?.message).toMatch(refuse);
    }
    expect((await svc.from("orders").select("swapped_to_order_id").eq("id", a).single()).data!.swapped_to_order_id).toBe(b);
    expect(await held(other)).toBe(1);
    expect(await held(fresh)).toBe(0);
  });

  test("swap logs the link on the original and the replacement (returning)", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    const { data: b } = await swap(a);
    expect((await moves(b as string)).map((m) => m.reason)).toEqual(["order_swapped"]);
    expect(await held(a)).toBe(0);
  });

  test("swap succeeds from returning and returned", async () => {
    for (const st of ["returning", "returned"]) {
      const p = await product();
      const a = await order(p, { delivery_status: st, quantity: 1 });
      const { data: b, error } = await swap(a);
      expect(error).toBeNull();
      expect(await held(a)).toBe(0);
      expect(await held(b as string)).toBe(1);
      expect((await svc.from("orders").select("delivery_status").eq("id", a).single()).data!.delivery_status).toBe("swap");
    }
  });

  test("swap refused from delivered and exchange (D48): nothing is created or linked", async () => {
    for (const st of ["delivered", "exchange"]) {
      const p = await product();
      const a = await order(p, { delivery_status: st, quantity: 1 });
      expect((await swap(a)).error?.message).toMatch(/swap not allowed from status/);
      expect((await svc.from("orders").select("swapped_to_order_id, delivery_status").eq("id", a).single()).data).toMatchObject({
        swapped_to_order_id: null, delivery_status: st,
      });
      const { count } = await svc.from("orders").select("id", { count: "exact", head: true }).eq("product_id", p);
      expect(count).toBe(1);
    }
  });

  test("deleting a replacement: before pickup releases, on road or delivered keeps the piece out (D42)", async () => {
    for (const [st, expected] of [["wait_for_deposit", 0], ["in_transit", -1], ["delivered", -1], ["cancelled", 0]] as const) {
      const p = await product();
      const a = await order(p, { delivery_status: "returning", quantity: 1 });
      const { data: b } = await swap(a);
      if (st !== "wait_for_deposit") await status(b as string, st);
      expect((await svc.from("orders").delete().eq("id", b as string)).error).toBeNull();
      // A is a swap original again (status swap, link cleared): holds nothing
      expect(await held(a)).toBe(0);
      expect(await stock(p)).toBe(expected);
    }
  });

  test("swap_order across workspaces is refused both ways", async () => {
    const admin2 = await userIn(ws2, "admin");
    const p = await product();
    const a = await order(p, { delivery_status: "returned", quantity: 1 });
    expect((await swap(a, null, admin2)).error?.message).toMatch(/order not found/);
    const o2 = await order(null, { delivery_status: "returned" }, ws2);
    expect((await swap(o2)).error?.message).toMatch(/order not found/);
  });

  test("D30 on UPDATE: changing product_id to another workspace's product is refused", async () => {
    const p = await product();
    const p2 = await product(ws2);
    const o = await order(p, { delivery_status: "in_transit" });
    expect((await svc.from("orders").update({ product_id: p2 }).eq("id", o)).error?.message).toMatch(/workspace/);
    expect(await stock(p)).toBe(-2);
  });

  test("first run of 00029 fixes a stale order, second run writes nothing", async () => {
    const p = await product();
    const o = await order(p, { delivery_status: "in_transit" }); // -2
    await svc.from("stock_movements").insert({ workspace_id: ws, product_id: p, delta: 2, reason: "order_reverted", order_id: o });
    expect(await stock(p)).toBe(0);
    const sql = reconcileWs(ws);
    psql(sql);
    expect(await stock(p)).toBe(-2);
    const n = (await moves(o)).length;
    psql(sql);
    expect((await moves(o)).length).toBe(n);
  });

  test("cancelled replacement releases its piece and shows on_road 0", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    const { data: b } = await swap(a);
    expect(await stages(p)).toMatchObject({ on_road: 1 });
    expect(await stock(p)).toBe(-1);
    const { error } = await svc.from("orders").update({ confirmation_status: "cancelled" }).eq("id", b as string);
    expect(error).toBeNull();
    expect(await held(b as string)).toBe(0);
    expect(await stock(p)).toBe(0);
    expect(await stages(p)).toMatchObject({ reserved: 0, on_road: 0, delivered: 0 });
  });

  test("non-replacement on-road order cancelled at confirmation keeps its stock (review-1 #1)", async () => {
    const p = await product();
    const o = await order(p, { delivery_status: "in_transit", quantity: 1 });
    expect(await stock(p)).toBe(-1);
    expect((await svc.from("orders").update({ confirmation_status: "cancelled" }).eq("id", o)).error).toBeNull();
    expect(await held(o)).toBe(1);
    expect(await stock(p)).toBe(-1);
    expect(await stages(p)).toMatchObject({ on_road: 1 });
  });

  test("swap status refused for admin PATCH, insert and carrier map entry (review-1 #2-3)", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returned", quantity: 1 });
    const refuse = /swap is set only by swap_order/;
    expect((await adminUser.from("orders").update({ delivery_status: "swap" }).eq("id", a)).error?.message).toMatch(refuse);
    for (const c of [svc, adminUser]) {
      expect((await c.from("orders").insert({ workspace_id: ws, product_id: p, quantity: 1, delivery_status: "swap" })).error?.message).toMatch(refuse);
    }
    expect((await svc.from("orders").update({ delivery_status: "swap" }).eq("id", a)).error?.message).toMatch(refuse);
    // carrier map entry x -> swap: sync does not fail and does not apply it
    const parcel = crypto.randomUUID();
    expect((await svc.from("zr_shipments").insert({ order_id: a, workspace_id: ws, parcel_id: parcel })).error).toBeNull();
    await svc.from("settings").upsert({ workspace_id: ws, key: "zr_state_map", value: { map: { x: "swap" } } }, { onConflict: "workspace_id,key" });
    const r = await svc.rpc("apply_zr_state", { p_ws: ws, p_parcel: parcel, p_state: "X", p_slug: null, p_situation: null, p_is_return: null, p_occurred: new Date().toISOString() });
    expect(r.error).toBeNull();
    expect((await svc.from("orders").select("delivery_status").eq("id", a).single()).data!.delivery_status).toBe("returned");
    await svc.from("settings").delete().eq("workspace_id", ws).eq("key", "zr_state_map");
  });

  test("un-cancelling a replacement re-reserves it", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    const { data: b } = await swap(a);
    await svc.from("orders").update({ confirmation_status: "cancelled" }).eq("id", b as string);
    await svc.from("orders").update({ confirmation_status: "confirmed" }).eq("id", b as string);
    expect(await held(b as string)).toBe(1);
    expect(await stock(p)).toBe(-1);
    expect(await stages(p)).toMatchObject({ on_road: 1 });
  });

  test("manual swap status refused for admin; swap_order still succeeds", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returned", quantity: 1 });
    const manual = await adminUser.rpc("transition_order_status", { p_order_id: a, p_delivery_status: "swap" });
    expect(manual.error?.message).toMatch(/only by swap_order/);
    expect((await svc.from("orders").select("delivery_status").eq("id", a).single()).data!.delivery_status).toBe("returned");
    const { data: b, error } = await swap(a);
    expect(error).toBeNull();
    expect(b).toBeTruthy();
    expect((await svc.from("orders").select("delivery_status").eq("id", a).single()).data!.delivery_status).toBe("swap");
    // the flag does not leak: a later manual swap is still refused
    const again = await order(p, { delivery_status: "returned", quantity: 1 });
    expect((await adminUser.rpc("transition_order_status", { p_order_id: again, p_delivery_status: "swap" })).error).not.toBeNull();
  });

  test("apply_zr_state updates a linked original, stock unchanged", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    expect((await swap(a)).error).toBeNull();
    const ship = await svc.from("zr_shipments").insert({ order_id: a, workspace_id: ws, parcel_id: crypto.randomUUID() });
    expect(ship.error).toBeNull();
    const n = (await moves(a)).length;
    const r = await svc.rpc("apply_zr_state", {
      p_ws: ws, p_parcel: (await svc.from("zr_shipments").select("parcel_id").eq("order_id", a).single()).data!.parcel_id,
      p_state: "livre", p_slug: "livre", p_situation: null as unknown as string, p_is_return: null as unknown as boolean,
      p_occurred: new Date().toISOString(),
    });
    expect(r.error).toBeNull();
    expect((await svc.from("orders").select("delivery_status").eq("id", a).single()).data!.delivery_status).toBe("delivered");
    expect((await svc.from("zr_shipments").select("order_id").eq("order_id", a)).data).toHaveLength(1);
    expect((await moves(a)).length).toBe(n);
    expect(await held(a)).toBe(0);
  });

  test("deleting the replacement returns the original to the normal rule", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    const { data: b } = await swap(a);
    await status(a, "delivered"); // carrier moves the linked original on from `swap`
    expect(await held(a)).toBe(0);
    expect((await svc.from("orders").delete().eq("id", b as string)).error).toBeNull();
    expect((await svc.from("orders").select("swapped_to_order_id").eq("id", a).single()).data!.swapped_to_order_id).toBeNull();
    expect(await held(a)).toBe(1); // delivered is on the carrier again: normal target
    expect(await stock(p)).toBe(-1);
  });

  test("admin cancel of in-transit replacement via transition_order_status", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    const { data: b } = await swap(a);
    const bid = b as string;
    expect((await adminUser.rpc("transition_order_status", { p_order_id: bid, p_delivery_status: "in_transit" })).error).toBeNull();
    expect(await held(bid)).toBe(1);
    expect((await adminUser.rpc("transition_order_status", { p_order_id: bid, p_delivery_status: "cancelled" })).error).toBeNull();
    expect(await held(bid)).toBe(0);
    expect(await held(a)).toBe(0); // still linked: original holds nothing
    expect(await stock(p)).toBe(0);
  });

  test("product_stock_stages refuses insert/update/delete", async () => {
    const p = await product();
    for (const c of [adminUser, svc]) {
      expect((await c.from("product_stock_stages").insert({ product_id: p, workspace_id: ws })).error).not.toBeNull();
      expect((await c.from("product_stock_stages").update({ in_stock: 5 }).eq("product_id", p)).error).not.toBeNull();
      expect((await c.from("product_stock_stages").delete().eq("product_id", p)).error).not.toBeNull();
    }
  });

  test("stock log created_by spoof refused", async () => {
    const p = await product();
    const me = (await adminUser.auth.getUser()).data.user!.id;
    const other = (await confAgent.auth.getUser()).data.user!.id;
    const row = { workspace_id: ws, product_id: p, delta: 1, reason: "correction" as const };
    expect((await adminUser.from("stock_movements").insert({ ...row, created_by: other })).error).not.toBeNull();
    expect((await adminUser.from("stock_movements").insert({ ...row, created_by: me })).error).toBeNull();
    const ins = await adminUser.from("stock_movements").insert(row).select("created_by").single();
    expect(ins.error).toBeNull();
    expect(ins.data!.created_by).toBe(me);
  });

  test("shipped replacement cancelled at confirmation keeps its piece out, also after delivered (review-2 #1)", async () => {
    const p = await product();
    const a = await order(p, { delivery_status: "returning", quantity: 1 });
    const { data: b } = await swap(a);
    await status(b as string, "in_transit");
    expect((await svc.from("orders").update({ confirmation_status: "cancelled" }).eq("id", b as string)).error).toBeNull();
    expect(await stock(p)).toBe(-1);
    expect(await stages(p)).toMatchObject({ on_road: 1 });
    await status(b as string, "delivered");
    expect(await stock(p)).toBe(-1);
  });

  test("all security definer functions have search_path with pg_temp", async () => {
    const bad = psql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%pg_temp%')`).trim();
    expect(bad).toBe("");
  });
});
