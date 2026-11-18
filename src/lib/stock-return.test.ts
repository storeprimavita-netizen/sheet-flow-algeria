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
describe.skipIf(!URL)("order_stock_effects: D25 reconcile (00028)", () => {
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
    await admin.from("workspaces").delete().eq("id", ws);
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
});
