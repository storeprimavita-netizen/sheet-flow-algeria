import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";

const URL = process.env.LOCAL_SUPABASE_URL;
const ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const SEED_PASSWORD = "SeedDev!2026";
const QTY = 3;

// P0-8 / D25: stock held by an order is reconciled to its target after every update.
// Each run uses its OWN throwaway product and order (live stack).
describe.skipIf(!URL)("order_stock_effects: D25 reconcile (00028-00030)", () => {
  let admin: SupabaseClient;
  let ws: string;
  let productId: string;
  let orderId: string;
  let start: number;
  let userId: string;
  let email: string;

  type Mv = { reason: string; delta: number };
  const opts = { auth: { persistSession: false, autoRefreshToken: false } };
  const stockOf = async () => (await admin.from("products").select("stock").eq("id", productId).single()).data!.stock as number;
  const moves = async () => ((await admin.from("stock_movements").select("reason, delta").eq("order_id", orderId)).data ?? []) as Mv[];
  const net = async () => (await moves()).reduce((s, m) => s + m.delta, 0);
  const setO = async (patch: Record<string, string | number>, client: SupabaseClient = admin) => {
    const { error } = await client.from("orders").update(patch).eq("id", orderId);
    expect(error).toBeNull();
  };
  const confirmed = { confirmation_status: "confirmed" };

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY, opts);
    // own workspace: other suites compute workspace-wide sums and must not see these rows
    ws = (await admin.from("workspaces").insert({ name: `stock-test-${crypto.randomUUID()}` }).select("id").single()).data!.id;
    const created = await admin.auth.admin.createUser({ email: `stock-${crypto.randomUUID()}@seed.mnw`, password: SEED_PASSWORD, email_confirm: true });
    expect(created.error).toBeNull();
    userId = created.data.user!.id;
    email = created.data.user!.email!;
    await admin.from("profiles").upsert({ user_id: userId, workspace_id: ws, role: "admin", is_active: true }, { onConflict: "user_id" });
    const { data: p, error } = await admin.from("products").insert({ workspace_id: ws, name: `stock-test-${crypto.randomUUID()}` }).select("id").single();
    expect(error).toBeNull();
    productId = p!.id;
    await admin.from("stock_movements").insert({ workspace_id: ws, product_id: productId, delta: 100, reason: "purchase" });
  });
  beforeEach(async () => {
    const { data: o, error } = await admin.from("orders").insert({ workspace_id: ws, product_id: productId, quantity: QTY }).select("id").single();
    expect(error).toBeNull();
    orderId = o!.id;
    start = await stockOf();
  });
  afterAll(async () => {
    if (!admin || !productId) return;
    await admin.from("orders").delete().eq("product_id", productId).then(() => undefined, () => undefined);
    await admin.from("stock_movements").delete().eq("product_id", productId);
    await admin.from("orders").delete().eq("product_id", productId);
    await admin.from("products").delete().eq("id", productId);
    await admin.from("profiles").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
    expect((await admin.from("workspaces").delete().eq("id", ws)).error).toBeNull();
  });

  test("returned net 0 for a confirmed order, then delivered nets -qty", async () => {
    await setO(confirmed);
    expect(await stockOf()).toBe(start - QTY);
    await setO({ delivery_status: "returned" });
    expect(await net()).toBe(0);
    expect(await stockOf()).toBe(start);
    await setO({ delivery_status: "delivered" });
    expect(await net()).toBe(-QTY);
    expect(await stockOf()).toBe(start - QTY);
  });

  test("reopen returned order in one update then re-confirm nets -qty (review-1 HIGH)", async () => {
    await setO(confirmed);
    await setO({ delivery_status: "delivered" });
    await setO({ delivery_status: "returned" });
    await setO({ confirmation_status: "wait_for_confirmation", delivery_status: "wait_for_deposit" });
    expect(await net()).toBe(0);
    await setO(confirmed);
    expect(await net()).toBe(-QTY);
    expect(await stockOf()).toBe(start - QTY);
  });

  test("returned then cancelled keeps the restock (D25)", async () => {
    await setO(confirmed);
    await setO({ delivery_status: "returned" });
    await setO({ delivery_status: "cancelled" });
    expect(await net()).toBe(0);
    expect(await stockOf()).toBe(start);
  });

  test("unconfirmed order returned then reshipped nets zero", async () => {
    await setO({ delivery_status: "returned" });
    await setO({ delivery_status: "in_transit" });
    await setO({ delivery_status: "delivered" });
    expect(await moves()).toHaveLength(0);
    expect(await stockOf()).toBe(start);
  });

  test("confirm and leave returned in the same update writes one reconciling movement", async () => {
    await setO({ delivery_status: "returned" });
    await setO({ ...confirmed, delivery_status: "in_transit" });
    expect(await moves()).toEqual([{ reason: "order_confirmed", delta: -QTY }]);
    expect(await stockOf()).toBe(start - QTY);
  });

  test("repeated identical update writes no movement", async () => {
    await setO(confirmed);
    await setO(confirmed);
    await setO({ delivery_status: "in_transit" });
    await setO({ delivery_status: "in_transit" });
    expect(await moves()).toHaveLength(1);
    expect(await stockOf()).toBe(start - QTY);
  });

  test("quantity change while confirmed adjusts the difference", async () => {
    await setO(confirmed);
    await setO({ quantity: QTY + 2 });
    expect(await net()).toBe(-(QTY + 2));
    expect(await stockOf()).toBe(start - QTY - 2);
    await setO({ quantity: 1 });
    expect(await stockOf()).toBe(start - 1);
  });

  test("admin session (not service role) leaving returned writes the movement", async () => {
    await setO(confirmed);
    await setO({ delivery_status: "returned" });
    const adminUser = createClient(URL!, ANON_KEY, opts);
    const { error } = await adminUser.auth.signInWithPassword({ email, password: SEED_PASSWORD });
    expect(error).toBeNull();
    await setO({ delivery_status: "in_transit" }, adminUser);
    expect(await net()).toBe(-QTY);
    expect(await stockOf()).toBe(start - QTY);
  });
  test("changing product while confirmed moves the stock between products; A -> B -> A nets -qty", async () => {
    const { data: p2 } = await admin.from("products").insert({ workspace_id: ws, name: `stock-test-${crypto.randomUUID()}` }).select("id").single();
    const stockP = async (id: string) => (await admin.from("products").select("stock").eq("id", id).single()).data!.stock as number;
    try {
      await setO(confirmed);
      expect((await admin.from("orders").update({ product_id: p2!.id }).eq("id", orderId)).error).toBeNull();
      expect(await stockOf()).toBe(start);
      expect(await stockP(p2!.id)).toBe(-QTY);
      expect((await admin.from("orders").update({ product_id: productId }).eq("id", orderId)).error).toBeNull();
      expect(await stockOf()).toBe(start - QTY);
      expect(await stockP(p2!.id)).toBe(0);
    } finally {
      await admin.from("orders").update({ product_id: productId }).eq("id", orderId);
      await admin.from("stock_movements").delete().eq("product_id", p2!.id);
      await admin.from("products").delete().eq("id", p2!.id);
    }
  });

  test("swap (D29): new order holds stock at creation, original releases, net -qty once", async () => {
    await setO(confirmed);
    await setO({ delivery_status: "delivered" });
    const { data: b } = await admin.from("orders").insert({ workspace_id: ws, product_id: productId, quantity: QTY, ...confirmed }).select("id").single();
    expect(await stockOf()).toBe(start - 2 * QTY); // B holds from creation, A not yet released
    await setO({ delivery_status: "swap" });
    expect(await stockOf()).toBe(start - QTY);
    await admin.from("orders").update({ delivery_status: "in_transit" }).eq("id", b!.id);
    expect(await stockOf()).toBe(start - QTY);
    await admin.from("stock_movements").delete().eq("order_id", b!.id);
    await admin.from("orders").delete().eq("id", b!.id);
  });

  test("exchange keeps stock held", async () => {
    await setO(confirmed);
    await setO({ delivery_status: "exchange" });
    expect(await net()).toBe(-QTY);
  });

  test("legacy delivered row: no-op edit writes nothing; later return restocks", async () => {
    await admin.from("stock_movements").insert({ workspace_id: ws, product_id: productId, order_id: orderId, delta: -QTY, reason: "delivered" });
    await setO({ confirmation_status: "confirmed", delivery_status: "delivered" });
    expect(await net()).toBe(-QTY);
    await setO({ commune: "x" });
    expect(await net()).toBe(-QTY);
    await setO({ delivery_status: "returned" });
    expect(await net()).toBe(0);
  });

  test("early return: with drift present, a note edit writes no movement; a real change reconciles", async () => {
    await setO(confirmed);
    await admin.from("stock_movements").insert({ workspace_id: ws, product_id: productId, order_id: orderId, delta: QTY, reason: "order_reverted" });
    const before = (await moves()).length;
    await setO({ commune: "edit" });
    expect(await moves()).toHaveLength(before);
    await setO({ delivery_status: "in_transit" });
    const m = await moves();
    expect(m).toHaveLength(before + 1);
    expect(m).toContainEqual({ reason: "order_stock_sync", delta: -QTY });
    expect(await net()).toBe(-QTY);
  });

  test("insert: only a confirmed, live order holds stock", async () => {
    const mk = async (extra: Record<string, string>) => {
      const { data, error } = await admin.from("orders").insert({ workspace_id: ws, product_id: productId, quantity: QTY, ...extra }).select("id").single();
      expect(error).toBeNull();
      const { data: mv } = await admin.from("stock_movements").select("delta").eq("order_id", data!.id);
      return (mv ?? []).length;
    };
    expect(await mk({})).toBe(0);
    for (const d of ["returned", "cancelled", "swap"]) expect(await mk({ ...confirmed, delivery_status: d })).toBe(0);
    expect(await mk({ ...confirmed, delivery_status: "in_transit" })).toBe(1);
    expect(await stockOf()).toBe(start - QTY);
  });

  test("product_id set to null returns all held stock to the old product", async () => {
    await setO(confirmed);
    const { error } = await admin.from("orders").update({ product_id: null }).eq("id", orderId);
    expect(error).toBeNull();
    expect(await stockOf()).toBe(start);
    await admin.from("orders").update({ product_id: productId }).eq("id", orderId);
  });

  test("exchange -> returned releases the stock (D29)", async () => {
    await setO(confirmed);
    await setO({ delivery_status: "exchange" });
    await setO({ delivery_status: "returned" });
    expect(await net()).toBe(0);
  });

  test("reasons: swap release is order_swapped; a drifted row is order_stock_sync", async () => {
    await setO(confirmed);
    await setO({ delivery_status: "swap" });
    expect((await moves()).map((m) => m.reason)).toEqual(["order_confirmed", "order_swapped"]);
    const { data: o } = await admin.from("orders").insert({ workspace_id: ws, product_id: productId, quantity: QTY }).select("id").single();
    await admin.from("stock_movements").insert({ workspace_id: ws, product_id: productId, order_id: o!.id, delta: -QTY, reason: "delivered" });
    await admin.from("orders").update({ ...confirmed, delivery_status: "returned" }).eq("id", o!.id);
    const { data } = await admin.from("stock_movements").select("reason").eq("order_id", o!.id).order("created_at");
    expect(data!.map((m) => m.reason)).toEqual(["delivered", "order_stock_sync"]);
  });

  test("swap_order RPC: one transaction, B holds, A released, linked; admin only", async () => {
    await setO(confirmed);
    const adminUser = createClient(URL!, ANON_KEY, opts);
    expect((await adminUser.auth.signInWithPassword({ email, password: SEED_PASSWORD })).error).toBeNull();
    const args = { p_order_id: orderId, p_customer_id: null as unknown as string, p_customer_name: "n", p_customer_phone: "0555000000", p_wilaya_code: 16, p_commune: "", p_address: "" };
    const { data: bId, error } = await adminUser.rpc("swap_order", args);
    expect(error).toBeNull();
    expect(await stockOf()).toBe(start - QTY);
    const { data: a } = await admin.from("orders").select("delivery_status, swapped_to_order_id").eq("id", orderId).single();
    expect(a).toEqual({ delivery_status: "swap", swapped_to_order_id: bId });
    // a failing swap (bad wilaya) rolls everything back: A holds again, B was not created
    await setO({ delivery_status: "in_transit" });
    expect(await stockOf()).toBe(start - 2 * QTY);
    const bad = await adminUser.rpc("swap_order", { ...args, p_wilaya_code: 9999 });
    expect(bad.error).not.toBeNull();
    expect(await stockOf()).toBe(start - 2 * QTY);
    const { data: a2 } = await admin.from("orders").select("delivery_status").eq("id", orderId).single();
    expect(a2!.delivery_status).toBe("in_transit");
  });

  test("D30: another workspace's product is refused on orders and on movements", async () => {
    const ws2 = (await admin.from("workspaces").insert({ name: `stock-test-${crypto.randomUUID()}` }).select("id").single()).data!.id;
    const { data: p2 } = await admin.from("products").insert({ workspace_id: ws2, name: `stock-test-${crypto.randomUUID()}` }).select("id").single();
    try {
      await setO(confirmed);
      const adminUser = createClient(URL!, ANON_KEY, opts);
      await adminUser.auth.signInWithPassword({ email, password: SEED_PASSWORD });
      const r = await adminUser.from("orders").update({ product_id: p2!.id }).eq("id", orderId);
      expect(r.error).not.toBeNull();
      expect((await admin.from("orders").insert({ workspace_id: ws, product_id: p2!.id, quantity: 1 })).error).not.toBeNull();
      const mv = await admin.from("stock_movements").insert({ workspace_id: ws, product_id: p2!.id, delta: -1, reason: "correction" });
      expect(mv.error).not.toBeNull();
      expect((await admin.from("products").select("stock").eq("id", p2!.id).single()).data!.stock).toBe(0);
      expect(await stockOf()).toBe(start - QTY);
    } finally {
      await admin.from("products").delete().eq("id", p2!.id);
      await admin.from("workspaces").delete().eq("id", ws2);
    }
  });

  test("reconciling row has the right reason and created_by", async () => {
    await setO(confirmed);
    await setO({ delivery_status: "returned" });
    const adminUser = createClient(URL!, ANON_KEY, opts);
    await adminUser.auth.signInWithPassword({ email, password: SEED_PASSWORD });
    await setO({ delivery_status: "in_transit" }, adminUser);
    const { data } = await admin.from("stock_movements").select("reason, created_by").eq("order_id", orderId).order("created_at");
    expect(data!.map((m) => m.reason)).toEqual(["order_confirmed", "order_returned", "order_confirmed"]);
    expect(data![2].created_by).toBe(userId);
  });
});
