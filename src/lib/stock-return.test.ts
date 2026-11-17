import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const URL = process.env.LOCAL_SUPABASE_URL;
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// P0-8: leaving `returned` undoes the restock (live stack, service role).
describe.skipIf(!URL)("order_stock_effects: return undone (00028)", () => {
  let admin: SupabaseClient;
  let orderId: string;
  let productId: string;
  let qty: number;
  let orig: { delivery_status: string; confirmation_status: string };

  const stockOf = async () => (await admin.from("products").select("stock").eq("id", productId).single()).data!.stock as number;
  const reasons = async () =>
    ((await admin.from("stock_movements").select("reason, delta").eq("order_id", orderId)).data ?? []) as { reason: string; delta: number }[];
  const net = async () => (await reasons()).reduce((s, m) => s + m.delta, 0);
  const setO = async (patch: Record<string, string>) => {
    const { error } = await admin.from("orders").update(patch).eq("id", orderId);
    expect(error).toBeNull();
  };
  async function reset() {
    await admin.from("stock_movements").delete().eq("order_id", orderId);
    const { error } = await admin.from("orders").update({ delivery_status: "wait_for_deposit", confirmation_status: "wait_for_confirmation" }).eq("id", orderId);
    expect(error).toBeNull();
    await admin.from("stock_movements").delete().eq("order_id", orderId);
  }

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: o } = await admin.from("orders").select("id, product_id, quantity, delivery_status, confirmation_status")
      .not("product_id", "is", null).eq("delivery_status", "wait_for_deposit").neq("confirmation_status", "confirmed").limit(1).single();
    orderId = o!.id; productId = o!.product_id!; qty = o!.quantity;
    orig = { delivery_status: o!.delivery_status, confirmation_status: o!.confirmation_status };
  });
  afterAll(async () => {
    if (!admin) return;
    await admin.from("stock_movements").delete().eq("order_id", orderId);
    await admin.from("orders").update(orig).eq("id", orderId);
    await admin.from("stock_movements").delete().eq("order_id", orderId);
  });

  test("returned then delivered restores net stock (undo row, reason order_return_undone, delta -qty)", async () => {
    await reset();
    const start = await stockOf();
    await setO({ delivery_status: "returned" });
    expect(await stockOf()).toBe(start + qty);
    await setO({ delivery_status: "delivered" });
    expect(await reasons()).toContainEqual({ reason: "order_return_undone", delta: -qty });
    expect(await stockOf()).toBe(start);
  });

  test("returned -> in_transit -> returned -> delivered: movements net to -qty after confirm, stock == start - qty", async () => {
    await reset();
    const start = await stockOf();
    await setO({ confirmation_status: "confirmed" });
    await setO({ delivery_status: "returned" });
    await setO({ delivery_status: "in_transit" });
    await setO({ delivery_status: "returned" });
    await setO({ delivery_status: "delivered" });
    expect(await net()).toBe(-qty);
    expect(await stockOf()).toBe(start - qty);
  });

  test("leaving returned with no prior order_returned row writes nothing", async () => {
    await reset();
    const start = await stockOf();
    await setO({ delivery_status: "returned" });
    await admin.from("stock_movements").delete().eq("order_id", orderId).eq("reason", "order_returned");
    const mid = await stockOf();
    await setO({ delivery_status: "delivered" });
    expect((await reasons()).filter((m) => m.reason === "order_return_undone")).toHaveLength(0);
    expect(await stockOf()).toBe(mid);
    expect(start).toBeDefined();
  });

  test("confirm then fall back after returned does not double restore", async () => {
    await reset();
    const start = await stockOf();
    await setO({ confirmation_status: "confirmed" });
    await setO({ delivery_status: "returned" });
    await setO({ confirmation_status: "wait_for_confirmation" }); // branch 3 guard: returned excluded
    expect((await reasons()).filter((m) => m.reason === "order_reverted")).toHaveLength(0);
    expect(await stockOf()).toBe(start);
  });
});
