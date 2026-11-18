import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { recordCashCollection } from "@/app/(app)/app/orders/cash/actions";

/** Live P0-5 checks (cash_collections uniqueness / tenancy / audit). Needs the local stack. */
const URL = process.env.LOCAL_SUPABASE_URL;
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const psql = (sql: string) =>
  execFileSync("docker", ["exec", "-i", "supabase_db_mnw-erp", "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-tA"], {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

describe.skipIf(!URL)("cash_collections (00026)", () => {
  let admin: SupabaseClient;
  let ws1: string;
  let ws2: string;
  let orderId: string;
  let otherId: string;
  let productId: string;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY, { auth: { persistSession: false } });
    // Own data: workspaces, product and orders are created here and removed in afterAll.
    const mk = async (table: "workspaces" | "products" | "orders", row: Record<string, unknown>) => {
      const { data, error } = await admin.from(table).insert(row as never).select("id").single();
      if (error) throw new Error(`cash.test setup ${table}: ${error.message}`);
      return (data as { id: string }).id;
    };
    ws1 = await mk("workspaces", { name: `cash-test-ws1-${crypto.randomUUID()}` });
    ws2 = await mk("workspaces", { name: `cash-test-ws2-${crypto.randomUUID()}` });
    productId = await mk("products", { workspace_id: ws1, name: `cash-test-${crypto.randomUUID()}` });
    orderId = await mk("orders", { workspace_id: ws1, product_id: productId, quantity: 1 });
    otherId = await mk("orders", { workspace_id: ws1, product_id: productId, quantity: 1 });
  });
  afterAll(async () => {
    if (!admin || !ws1) return;
    // the stock log is add-only: delete orders, then the product (movements follow by cascade)
    await admin.from("cash_collections").delete().in("workspace_id", [ws1, ws2]);
    await admin.from("orders").delete().eq("workspace_id", ws1);
    await admin.from("products").delete().eq("id", productId);
    expect((await admin.from("workspaces").delete().eq("id", ws1)).error).toBeNull();
    expect((await admin.from("workspaces").delete().eq("id", ws2)).error).toBeNull();
  });

  test("second insert for the same order_id -> 23505; NULL order_id rows stay allowed", async () => {
    const row = { workspace_id: ws1, order_id: orderId, amount_dzd: 1 };
    const a = await admin.from("cash_collections").insert(row).select("id").single();
    expect(a.error).toBeNull();
    expect((await admin.from("cash_collections").insert(row)).error?.code).toBe("23505");
    for (let i = 0; i < 2; i++) {
      const n = await admin.from("cash_collections").insert({ workspace_id: ws1, amount_dzd: 1 }).select("id").single();
      expect(n.error).toBeNull();
    }
  });

  test("finance 'to collect': collected order embeds as an array with the cash row (excluded by .length)", async () => {
    const { data } = await admin.from("orders").select("id, cash:cash_collections(id)").eq("id", orderId).single();
    expect(Array.isArray(data!.cash)).toBe(true);
    expect(data!.cash).toHaveLength(1);
  });

  test("cross-workspace insert (ws2 row -> ws1 order) is rejected by the composite FK", async () => {
    const { error } = await admin.from("cash_collections").insert({ workspace_id: ws2, order_id: otherId, amount_dzd: 1 });
    expect(error?.code).toBe("23503");
  });

  test("audit trigger exists on cash_collections", () => {
    expect(psql("select count(*) from pg_trigger where tgrelid='public.cash_collections'::regclass and tgname='audit' and not tgisinternal;").trim()).toBe("1");
  });

  test("migration guard aborts (and deletes nothing) when duplicates exist", () => {
    const sql = readFileSync("supabase/migrations/00026_cash_unique_idx.sql", "utf8");
    const guard = sql.slice(sql.indexOf("-- guard:begin"), sql.indexOf("-- guard:end"));
    const run = `begin; drop index cash_collections_order_uidx;
      insert into cash_collections(workspace_id, order_id, amount_dzd) select '${ws1}','${orderId}',2;
      ${guard}
      rollback;`;
    expect(() => psql(run)).toThrow(/duplicate cash_collections: \d+ order_id/);
  });

  test("recordCashCollection rejects a non-uuid orderId", async () => {
    await expect(recordCashCollection("not-a-uuid", new FormData())).rejects.toThrow(/uuid/i);
  });

  test("order delete nulls order_id, cash row survives, audit row written", () => {
    const out = psql(`begin;
      insert into cash_collections(workspace_id, order_id, amount_dzd) values ('${ws1}','${otherId}',5);
      delete from orders where id='${otherId}';
      select (select count(*) from cash_collections where workspace_id='${ws1}' and amount_dzd=5 and order_id is null)
        || ',' || (select count(*) from audit_log where table_name='cash_collections' and action='INSERT' and (new_row->>'amount_dzd')::numeric=5);
      rollback;`);
    expect(out).toMatch(/^1,[1-9]/m);
  });
});
