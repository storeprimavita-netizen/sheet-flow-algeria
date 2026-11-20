import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live STORE-1 checks (D54): options, values, variants, stock per size, count by size. */
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

describe.skipIf(!URL)("product variants and stock per size (live DB)", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let adminUser: SupabaseClient;
  let confAgent: SupabaseClient;
  let ws: string;
  let ws2: string;
  const users: string[] = [];
  const tag = () => `v-${crypto.randomUUID()}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent") {
    const email = `st1-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }

  /** product + option "Size" + one value and one variant per label */
  async function product(labels: string[] = ["S", "M", "L"], workspace = ws) {
    const p = (await svc.from("products").insert({ workspace_id: workspace, name: tag() }).select("id").single()).data!.id as string;
    const o = (await svc.from("product_options").insert({ workspace_id: workspace, product_id: p, name: "Size" }).select("id").single()).data!.id as string;
    const values: Record<string, string> = {};
    const variants: Record<string, string> = {};
    for (const [i, label] of labels.entries()) {
      const v = await svc.from("product_option_values").insert({ workspace_id: workspace, product_id: p, option_id: o, label, position: i }).select("id").single();
      expect(v.error).toBeNull();
      values[label] = v.data!.id;
      const x = await svc.from("product_variants").insert({ workspace_id: workspace, product_id: p }).select("id").single();
      expect(x.error).toBeNull();
      variants[label] = x.data!.id;
      const j = await svc.from("product_variant_values").insert({ variant_id: x.data!.id, option_id: o, value_id: v.data!.id, product_id: p, workspace_id: workspace });
      expect(j.error).toBeNull();
    }
    return { p, o, values, variants };
  }
  async function order(p: string, variantId: string | null, over: Record<string, unknown> = {}, workspace = ws) {
    const r = await svc
      .from("orders")
      .insert({ workspace_id: workspace, product_id: p, variant_id: variantId, quantity: 2, confirmation_status: "confirmed", ...over })
      .select("id")
      .single();
    expect(r.error).toBeNull();
    return r.data!.id as string;
  }
  const status = async (id: string, delivery_status: string) => expect((await svc.from("orders").update({ delivery_status }).eq("id", id)).error).toBeNull();
  const vstock = async (v: string) => (await svc.from("product_variants").select("stock").eq("id", v).single()).data!.stock as number;
  const pstock = async (p: string) => (await svc.from("products").select("stock").eq("id", p).single()).data!.stock as number;
  const buy = (p: string, delta: number, variant_id: string | null = null) =>
    svc.from("stock_movements").insert({ workspace_id: ws, product_id: p, variant_id, delta, reason: "purchase" });
  const moves = async (id: string) =>
    ((await svc.from("stock_movements").select("delta, reason, variant_id").eq("order_id", id).order("created_at")).data ?? []) as { delta: number; reason: string; variant_id: string | null }[];

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    anon = client(ANON_KEY);
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    adminUser = await userIn(ws, "admin");
    confAgent = await userIn(ws, "confirmation_agent");
  });
  afterAll(async () => {
    if (!svc) return;
    const wss = [ws, ws2].filter(Boolean);
    await svc.from("product_variant_values").delete().in("workspace_id", wss);
    for (const t of ["product_option_values", "product_options", "size_sets", "options", "option_sets", "settings", "wilaya_fees", "fixed_fees", "exchange_rates", "expenses", "product_costs", "cash_collections", "zr_shipments", "integration_configs"] as const) {
      await svc.from(t).delete().in("workspace_id", wss);
    }
    expect((await deleteWorkspaces(svc, wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  // ---- access -------------------------------------------------------------
  test("agent reads but cannot write options, values, variants; no cost field; anon has no grant", async () => {
    const { p, o, values, variants } = await product();
    for (const table of ["product_options", "product_option_values", "product_variants", "product_variant_values"] as const) {
      const r = await confAgent.from(table).select("*").eq("product_id", p);
      expect(r.error).toBeNull();
      expect(r.data!.length).toBeGreaterThan(0);
      expect(Object.keys(r.data![0]).filter((k) => /cost|price|margin|profit/i.test(k) && !/^(price_delta|price_override|compare_at_override)$/.test(k))).toEqual([]);
      expect((await anon.from(table).select("*")).error).not.toBeNull();
    }
    expect((await confAgent.from("product_options").insert({ workspace_id: ws, product_id: p, name: "X" })).error).not.toBeNull();
    expect((await confAgent.from("product_option_values").insert({ workspace_id: ws, product_id: p, option_id: o, label: "Q" })).error).not.toBeNull();
    expect((await confAgent.from("product_variants").insert({ workspace_id: ws, product_id: p })).error).not.toBeNull();
    const upd = await confAgent.from("product_variants").update({ sku: "hack" }).eq("id", variants.S).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await confAgent.from("product_option_values").delete().eq("id", values.S).select("id");
    expect(del.data ?? []).toEqual([]);
    expect((await adminUser.from("product_variants").update({ sku: "ok" }).eq("id", variants.S).select("id")).data).toHaveLength(1);
  });

  test("no function added by this task is executable by anon", () => {
    const out = psql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('variant_label','orders_variant_label','product_id_immutable',
        'product_variants_stock_guard','product_variant_values_unique_set','stock_count_variants')
      and has_function_privilege('anon', p.oid, 'execute')`);
    expect(out.trim()).toBe("");
  });

  // ---- integrity ----------------------------------------------------------
  test("a join row to a value of another product or workspace is refused; one value per option; duplicate value sets refused", async () => {
    const a = await product(["S", "M"]);
    const b = await product(["S", "M"]);
    const c = await product(["S"], ws2);
    const extra = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: a.p }).select("id").single()).data!.id as string;
    const bad = (value_id: string, product_id = a.p, workspace_id = ws) =>
      svc.from("product_variant_values").insert({ variant_id: extra, option_id: a.o, value_id, product_id, workspace_id });
    expect((await bad(b.values.S)).error).not.toBeNull(); // value of another product
    expect((await bad(c.values.S)).error).not.toBeNull(); // value of another workspace
    expect((await bad(a.values.S, a.p, ws2)).error).not.toBeNull(); // workspace mismatch
    expect((await bad(a.values.S)).error?.message).toMatch(/already has these values/); // same set as variant S
    expect((await bad(a.values.M)).error?.message).toMatch(/already has these values/);
    // two values of one option on one variant
    const second = await svc.from("product_variant_values").insert({ variant_id: a.variants.S, option_id: a.o, value_id: a.values.M, product_id: a.p, workspace_id: ws });
    expect(second.error).not.toBeNull();
    // two values with the same label in one option
    expect((await svc.from("product_option_values").insert({ workspace_id: ws, product_id: a.p, option_id: a.o, label: " s " })).error).not.toBeNull();
  });

  test("product_id is immutable on options, values and variants", async () => {
    const a = await product(["S"]);
    const b = await product(["S"]);
    expect((await svc.from("product_options").update({ product_id: b.p }).eq("id", a.o)).error).not.toBeNull();
    expect((await svc.from("product_variants").update({ product_id: b.p }).eq("id", a.variants.S)).error).not.toBeNull();
  });

  test("re-running the data migration adds nothing; blank, non-object and duplicate entries are skipped", async () => {
    const p = (
      await svc
        .from("products")
        .insert({
          workspace_id: ws,
          name: tag(),
          variants: [{ label: "X", sku: "x-1" }, { label: "  " }, 5, { label: "x" }, { label: "Y" }, { sku: "no-label" }, { label: 7 }],
        })
        .select("id")
        .single()
    ).data!.id as string;
    const sql = readFileSync("supabase/migrations/00043_product_variants_data.sql", "utf8");
    const count = async () => (await svc.from("product_variants").select("id, stock, sku").eq("product_id", p)).data!;
    psql(sql);
    const first = await count();
    expect(first).toHaveLength(2);
    expect(first.every((v) => v.stock === 0)).toBe(true);
    expect(first.find((v) => v.sku === "x-1")).toBeTruthy();
    expect(((await svc.from("product_options").select("id").eq("product_id", p)).data ?? []).length).toBe(1);
    psql(sql);
    expect(await count()).toHaveLength(2);
    expect(((await svc.from("product_options").select("id").eq("product_id", p)).data ?? []).length).toBe(1);
    expect(await pstock(p)).toBe(0);
  });

  test("variant and product mismatch is refused for orders and movements; a movement on a size moves the size and the total", async () => {
    const a = await product(["S"]);
    const b = await product(["S"]);
    expect((await svc.from("orders").insert({ workspace_id: ws, product_id: a.p, variant_id: b.variants.S, quantity: 1 })).error).not.toBeNull();
    expect((await svc.from("orders").insert({ workspace_id: ws, product_id: null, variant_id: a.variants.S, quantity: 1 })).error).not.toBeNull();
    expect((await buy(a.p, 3, b.variants.S)).error).not.toBeNull();
    // a purchase on a size (the product stock tab, as admin session)
    const r = await adminUser.from("stock_movements").insert({ workspace_id: ws, product_id: a.p, variant_id: a.variants.S, delta: 4, reason: "purchase", created_by: (await adminUser.auth.getUser()).data.user!.id });
    expect(r.error).toBeNull();
    expect(await vstock(a.variants.S)).toBe(4);
    expect(await pstock(a.p)).toBe(4);
  });

  test("a new variant starts at 0; direct stock update refused; a referenced variant cannot be deleted; a product delete cascades", async () => {
    const a = await product(["S"]);
    expect((await svc.from("product_variants").insert({ workspace_id: ws, product_id: a.p, stock: 5 })).error).not.toBeNull();
    expect((await svc.from("product_variants").update({ stock: 9 }).eq("id", a.variants.S)).error).not.toBeNull();
    expect((await svc.from("products").update({ stock: 9 }).eq("id", a.p)).error).not.toBeNull();
    await order(a.p, a.variants.S);
    expect((await svc.from("product_variants").delete().eq("id", a.variants.S)).error).not.toBeNull();
    const free = await product(["S", "M"]);
    expect((await svc.from("product_option_values").delete().eq("id", free.values.S)).error).not.toBeNull(); // used by a variant
    expect((await svc.from("products").delete().eq("id", free.p)).error).toBeNull();
    expect(((await svc.from("product_variants").select("id").eq("product_id", free.p)).data ?? []).length).toBe(0);
  });

  // ---- stock follows the size --------------------------------------------
  test.each(["bureau_deposited", "in_transit", "out_for_delivery", "delivered", "returning", "exchange"])(
    "changing M to L at %s moves the hold in one logged step (order_stock_sync)",
    async (stage) => {
      const a = await product(["M", "L"]);
      await buy(a.p, 10);
      const o = await order(a.p, a.variants.M);
      await status(o, stage);
      expect(await vstock(a.variants.M)).toBe(-2);
      expect(await pstock(a.p)).toBe(8);
      expect((await svc.from("orders").update({ variant_id: a.variants.L }).eq("id", o)).error).toBeNull();
      expect(await vstock(a.variants.M)).toBe(0);
      expect(await vstock(a.variants.L)).toBe(-2);
      expect(await pstock(a.p)).toBe(8); // total unchanged: the piece is still out
      const m = await moves(o);
      expect(m.slice(-2).map((x) => x.reason)).toEqual(["order_stock_sync", "order_stock_sync"]);
      expect((await svc.from("orders").select("variant").eq("id", o).single()).data!.variant).toBe("L");
    },
  );

  test("a size goes to -1 without refusing a status change; the stage view is unchanged", async () => {
    const a = await product(["M"]);
    await buy(a.p, 5); // all on the product, none on the size: nothing counted
    const o = await order(a.p, a.variants.M, { quantity: 1 });
    await status(o, "in_transit");
    expect(await vstock(a.variants.M)).toBe(-1);
    const view = await svc.from("product_variant_stock_v").select("*").eq("product_id", a.p).single();
    expect(view.data).toMatchObject({ total: 4, variants_total: -1, not_assigned: 5, count_needed: true });
    await status(o, "delivered");
    const stages = await adminUser.from("product_stock_stages").select("in_stock, reserved, on_road, delivered").eq("product_id", a.p).single();
    expect(stages.data).toMatchObject({ in_stock: 4, reserved: 0, on_road: 0, delivered: 1 });
  });

  test("a legacy order (label only) keeps moving the product; assigning a size takes the piece from not assigned", async () => {
    const a = await product(["M"]);
    await buy(a.p, 5);
    const o = await order(a.p, null, { quantity: 1, variant: "typed M" });
    await status(o, "in_transit");
    expect(await pstock(a.p)).toBe(4);
    expect(await vstock(a.variants.M)).toBe(0);
    expect((await svc.from("orders").update({ variant_id: a.variants.M }).eq("id", o)).error).toBeNull();
    expect(await vstock(a.variants.M)).toBe(-1);
    expect(await pstock(a.p)).toBe(4);
  });

  test("order delete releases per size (old-rule reservation)", async () => {
    const a = await product(["M"]);
    await buy(a.p, 5);
    const o = await order(a.p, a.variants.M, { confirmation_status: "wait_for_confirmation" });
    expect((await svc.from("stock_movements").insert({ workspace_id: ws, product_id: a.p, variant_id: a.variants.M, delta: -2, reason: "order_confirmed", order_id: o })).error).toBeNull();
    expect(await vstock(a.variants.M)).toBe(-2);
    expect((await svc.from("orders").delete().eq("id", o)).error).toBeNull();
    expect(await vstock(a.variants.M)).toBe(0);
    expect(await pstock(a.p)).toBe(5);
  });

  test("swap keeps the size, even if it was deactivated since", async () => {
    const a = await product(["M"]);
    await buy(a.p, 5);
    const o = await order(a.p, a.variants.M);
    await status(o, "returning");
    await svc.from("product_variants").update({ is_active: false }).eq("id", a.variants.M);
    const r = await adminUser.rpc("swap_order", { p_order_id: o, p_customer_id: null as unknown as string, p_customer_name: "B", p_customer_phone: "0555000111", p_wilaya_code: 16, p_commune: "x", p_address: "y" });
    expect(r.error).toBeNull();
    const b = (await svc.from("orders").select("variant_id, variant").eq("id", r.data as string).single()).data!;
    expect(b.variant_id).toBe(a.variants.M);
    expect(b.variant).toBe("M");
  });

  test("an inactive size is refused on insert and on update of variant_id; a direct patch writes the label", async () => {
    const a = await product(["M", "L"]);
    await svc.from("product_variants").update({ is_active: false }).eq("id", a.variants.L);
    expect((await svc.from("orders").insert({ workspace_id: ws, product_id: a.p, variant_id: a.variants.L, quantity: 1 })).error?.message).toMatch(/inactive/);
    const o = await order(a.p, a.variants.M);
    expect((await svc.from("orders").update({ variant_id: a.variants.L }).eq("id", o)).error?.message).toMatch(/inactive/);
    await svc.from("product_variants").update({ is_active: true }).eq("id", a.variants.L);
    expect((await svc.from("orders").update({ variant_id: a.variants.L }).eq("id", o)).error).toBeNull();
    expect((await svc.from("orders").select("variant").eq("id", o).single()).data!.variant).toBe("L");
    // an unrelated update of an order on an inactive size is fine
    await svc.from("product_variants").update({ is_active: false }).eq("id", a.variants.L);
    expect((await svc.from("orders").update({ customer_name: "x" }).eq("id", o)).error).toBeNull();
  });

  test("an agent cannot change variant_id", async () => {
    const a = await product(["M", "L"]);
    const o = await order(a.p, a.variants.M, { confirmation_status: "wait_for_confirmation" });
    const r = await confAgent.from("orders").update({ variant_id: a.variants.L }).eq("id", o).select("id");
    expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
    expect((await svc.from("orders").select("variant_id").eq("id", o).single()).data!.variant_id).toBe(a.variants.M);
  });

  // ---- count by size ------------------------------------------------------
  test("count by size: absolute counts, two linked lines per changed size, total unchanged", async () => {
    const a = await product(["S", "M", "L"]);
    await buy(a.p, 20);
    const r = await adminUser.rpc("stock_count_variants", {
      p_product: a.p,
      p_counts: [{ variant_id: a.variants.S, count: 5 }, { variant_id: a.variants.M, count: 7 }, { variant_id: a.variants.L, count: 0 }],
    });
    expect(r.error).toBeNull();
    expect(r.data).toBe(2); // L already matched
    expect(await vstock(a.variants.S)).toBe(5);
    expect(await vstock(a.variants.M)).toBe(7);
    expect(await pstock(a.p)).toBe(20);
    expect((await svc.from("product_variant_stock_v").select("not_assigned, count_needed").eq("product_id", a.p).single()).data).toMatchObject({ not_assigned: 8, count_needed: true });
    const lines = (await svc.from("stock_movements").select("count_id, delta, variant_id").eq("reason", "stock_count").eq("product_id", a.p)).data!;
    expect(lines).toHaveLength(4);
    const byCount = Map.groupBy(lines, (l) => l.count_id);
    expect(byCount.size).toBe(2);
    for (const pair of byCount.values()) expect(pair.reduce((s, l) => s + l.delta, 0)).toBe(0);
    // typing the same numbers again changes nothing
    const again = await adminUser.rpc("stock_count_variants", { p_product: a.p, p_counts: [{ variant_id: a.variants.S, count: 5 }] });
    expect(again.data).toBe(0);
    // counts are absolute: a later count of 3 moves -2
    await adminUser.rpc("stock_count_variants", { p_product: a.p, p_counts: [{ variant_id: a.variants.S, count: 3 }] });
    expect(await vstock(a.variants.S)).toBe(3);
    expect(await pstock(a.p)).toBe(20);
  });

  test("count by size: refused for another workspace's product, an agent, anon and a variant of another product", async () => {
    const a = await product(["S"]);
    const other = await product(["S"]);
    const foreign = await product(["S"], ws2);
    const c = (p: string, v: string) => ({ p_product: p, p_counts: [{ variant_id: v, count: 3 }] });
    expect((await adminUser.rpc("stock_count_variants", c(foreign.p, foreign.variants.S))).error).not.toBeNull();
    expect((await confAgent.rpc("stock_count_variants", c(a.p, a.variants.S))).error).not.toBeNull();
    expect((await anon.rpc("stock_count_variants", c(a.p, a.variants.S))).error).not.toBeNull();
    expect((await svc.rpc("stock_count_variants", c(a.p, a.variants.S))).error).not.toBeNull();
    expect((await adminUser.rpc("stock_count_variants", c(a.p, other.variants.S))).error?.message).toMatch(/does not belong/);
    expect(await vstock(a.variants.S)).toBe(0);
    expect(await vstock(other.variants.S)).toBe(0);
    expect((await adminUser.rpc("stock_count_variants", { p_product: a.p, p_counts: [{ variant_id: a.variants.S, count: -1 }] })).error).not.toBeNull();
  });

  // ---- save_variant_config (00048, D55) -----------------------------------
  const uid = () => crypto.randomUUID();
  const bare = async (workspace = ws) => (await svc.from("products").insert({ workspace_id: workspace, name: tag() }).select("id").single()).data!.id as string;
  type Cfg = { options: { id: string; name: string; kind?: string; values: { id: string; label: string; swatch_color?: string | null; swatch_image?: string | null }[] }[]; variants: { id: string; sku: string | null; is_active: boolean; values: Record<string, string> }[]; backfill?: unknown };
  const save = (c: SupabaseClient, p: string, cfg: Cfg) => c.rpc("save_variant_config", { p_product: p, p_config: cfg });
  const counts = async (p: string) => ({
    options: (await svc.from("product_options").select("id", { count: "exact", head: true }).eq("product_id", p)).count,
    variants: (await svc.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", p)).count,
  });
  const sizeCfg = () => {
    const o = uid(), s = uid(), m = uid(), vs = uid(), vm = uid();
    const cfg: Cfg = {
      options: [{ id: o, name: "Size", values: [{ id: s, label: "S" }, { id: m, label: "M" }] }],
      variants: [
        { id: vs, sku: null, is_active: true, values: { [o]: s } },
        { id: vm, sku: "SKU-M", is_active: true, values: { [o]: m } },
      ],
    };
    return { cfg, o, s, m, vs, vm };
  };

  test("save_variant_config: create, swap two labels, deactivate and reactivate in one transaction", async () => {
    const p = await bare();
    const a = sizeCfg();
    expect((await save(adminUser, p, a.cfg)).error).toBeNull();
    expect(await counts(p)).toEqual({ options: 1, variants: 2 });
    expect((await svc.from("product_variants").select("sku, stock").eq("id", a.vm).single()).data).toEqual({ sku: "SKU-M", stock: 0 });
    // swap S and M
    a.cfg.options[0].values = [{ id: a.s, label: "M" }, { id: a.m, label: "S" }];
    expect((await save(adminUser, p, a.cfg)).error).toBeNull();
    expect((await svc.from("product_option_values").select("label").eq("id", a.s).single()).data!.label).toBe("M");
    // deactivate, then reactivate; the size's values never change
    a.cfg.variants[0].is_active = false;
    expect((await save(adminUser, p, a.cfg)).error).toBeNull();
    expect((await svc.from("product_variants").select("is_active").eq("id", a.vs).single()).data!.is_active).toBe(false);
    a.cfg.variants[0].is_active = true;
    expect((await save(adminUser, p, a.cfg)).error).toBeNull();
    expect((await svc.from("product_variants").select("is_active").eq("id", a.vs).single()).data!.is_active).toBe(true);
    expect((await svc.from("product_variant_values").select("value_id").eq("variant_id", a.vs).single()).data!.value_id).toBe(a.s);
  });

  test("re-adding a label while the size using the old one still exists is refused", async () => {
    const p = await bare();
    const a = sizeCfg();
    expect((await save(adminUser, p, a.cfg)).error).toBeNull();
    // drop the "M" value and its size, add a new value labelled "M" (new id) with a new size
    const m2 = uid(), vm2 = uid();
    const o = a.cfg.options[0].id;
    a.cfg.options[0].values = [{ id: a.s, label: "S" }, { id: m2, label: "M" }];
    a.cfg.variants = [a.cfg.variants[0], { id: vm2, sku: null, is_active: true, values: { [o]: m2 } }];
    // the old M size still uses the old M value: refused (in use), nothing changes
    expect((await save(adminUser, p, a.cfg)).error?.code).toBe("23503");
  });

  test("re-adding a removed label after a clean removal, and inside one save", async () => {
    const b = sizeCfg();
    const p2 = await bare();
    b.cfg.variants = [b.cfg.variants[0]]; // only S has a size
    expect((await save(adminUser, p2, b.cfg)).error).toBeNull();
    const m3 = uid();
    b.cfg.options[0].values = [{ id: b.s, label: "S" }];
    expect((await save(adminUser, p2, b.cfg)).error).toBeNull(); // M removed
    b.cfg.options[0].values = [{ id: b.s, label: "S" }, { id: m3, label: "M" }];
    expect((await save(adminUser, p2, b.cfg)).error).toBeNull();
    // remove and re-add the same label inside ONE save
    const m4 = uid();
    b.cfg.options[0].values = [{ id: b.s, label: "S" }, { id: m4, label: "M" }];
    expect((await save(adminUser, p2, b.cfg)).error).toBeNull();
    expect((await svc.from("product_option_values").select("id").eq("product_id", p2).eq("label", "M")).data).toEqual([{ id: m4 }]);
  });

  test("a new size with empty values is refused", async () => {
    const p = await bare();
    const a = sizeCfg();
    a.cfg.variants[1].values = {};
    expect((await save(adminUser, p, a.cfg)).error?.message).toMatch(/incomplete size/);
    expect(await counts(p)).toEqual({ options: 0, variants: 0 });
    // zero options: value-less sizes are refused
    const z: Cfg = { options: [], variants: [{ id: uid(), sku: null, is_active: true, values: {} }] };
    expect((await save(adminUser, p, z)).error?.message).toMatch(/incomplete size/);
    // "values": null (direct RPC) is an incomplete size too
    const n = sizeCfg();
    (n.cfg.variants[1] as unknown as { values: unknown }).values = null;
    expect((await save(adminUser, p, n.cfg)).error?.message).toMatch(/incomplete size/);
    expect(await counts(p)).toEqual({ options: 0, variants: 0 });
    // a key that is not a payload option is refused too
    const b = sizeCfg();
    b.cfg.variants[1].values = { [uid()]: b.m };
    expect((await save(adminUser, p, b.cfg)).error?.message).toMatch(/incomplete size/);
    // the two-writer race is not reproducible in a single-connection test: the lock is covered by reasoning (same hashtext key in both functions)
  });

  test("save_variant_config: the stale-tab scenario is refused and writes nothing; a new option without a backfill value is refused (VAR-1: was stale)", async () => {
    const p = await bare();
    const o = uid(), s = uid(), m = uid();
    const tabA: Cfg = { options: [{ id: o, name: "Size", values: [{ id: s, label: "S" }, { id: m, label: "M" }] }], variants: [] };
    expect((await save(adminUser, p, tabA)).error).toBeNull();
    // tab B adds Color and saves S/Red and M/Red
    const c = uid(), red = uid(), vs = uid(), vm = uid();
    const tabB: Cfg = {
      options: [tabA.options[0], { id: c, name: "Color", values: [{ id: red, label: "Red" }] }],
      variants: [
        { id: vs, sku: null, is_active: true, values: { [o]: s, [c]: red } },
        { id: vm, sku: null, is_active: true, values: { [o]: m, [c]: red } },
      ],
    };
    expect((await save(adminUser, p, tabB)).error).toBeNull();
    // tab A saves sizes S and M with one option only
    const stale: Cfg = { ...tabA, variants: [{ id: uid(), sku: null, is_active: true, values: { [o]: s } }, { id: uid(), sku: null, is_active: true, values: { [o]: m } }] };
    const r = await save(adminUser, p, stale);
    expect(r.error?.message).toBe("stale");
    expect(await counts(p)).toEqual({ options: 2, variants: 2 });
    // a new option once sizes exist
    const extra: Cfg = { ...tabB, options: [...tabB.options, { id: uid(), name: "Fit", values: [{ id: uid(), label: "Slim" }] }] };
    expect((await save(adminUser, p, extra)).error?.message).toBe("incomplete size");
    expect(await counts(p)).toEqual({ options: 2, variants: 2 });
  });

  test("save_variant_config: ids of another product or workspace, another workspace's product, an agent and anon are refused", async () => {
    const mine = await product(["S"]);
    const p = await bare();
    const a = sizeCfg();
    // option id that lives under another product of the same workspace
    const stolen: Cfg = { options: [{ id: mine.o, name: "Size", values: [{ id: uid(), label: "Z" }] }], variants: [] };
    expect((await save(adminUser, p, stolen)).error?.message).toMatch(/another product/);
    // value id of another product
    const stolenValue: Cfg = { options: [{ id: uid(), name: "Size", values: [{ id: mine.values.S, label: "S" }] }], variants: [] };
    expect((await save(adminUser, p, stolenValue)).error).not.toBeNull();
    // ids from another workspace
    const foreign = await product(["S"], ws2);
    const f1: Cfg = { options: [{ id: foreign.o, name: "Size", values: [{ id: uid(), label: "Z" }] }], variants: [] };
    expect((await save(adminUser, p, f1)).error).not.toBeNull();
    const f2: Cfg = { ...a.cfg, variants: [{ id: foreign.variants.S, sku: null, is_active: true, values: { [a.o]: a.s } }] };
    expect((await save(adminUser, p, f2)).error).not.toBeNull();
    expect(await counts(p)).toEqual({ options: 0, variants: 0 });
    // a product of another workspace
    expect((await save(adminUser, foreign.p, a.cfg)).error).not.toBeNull();
    expect(await counts(foreign.p)).toEqual({ options: 1, variants: 1 });
    // agent, anon, service role
    expect((await save(confAgent, p, a.cfg)).error).not.toBeNull();
    expect((await save(anon, p, a.cfg)).error).not.toBeNull();
    expect((await save(svc, p, a.cfg)).error).not.toBeNull();
    expect(await counts(p)).toEqual({ options: 0, variants: 0 });
  });

  test("save_variant_config: a save refused half-way leaves no renamed option and no new size", async () => {
    const p = await bare();
    const a = sizeCfg();
    expect((await save(adminUser, p, a.cfg)).error).toBeNull();
    // rename the option, add a size with the same values as S: refused at commit
    const dup: Cfg = {
      options: [{ ...a.cfg.options[0], name: "Renamed" }],
      variants: [...a.cfg.variants, { id: uid(), sku: null, is_active: true, values: { [a.o]: a.s } }],
    };
    expect((await save(adminUser, p, dup)).error?.message).toMatch(/already has these values/);
    expect((await svc.from("product_options").select("name").eq("id", a.o).single()).data!.name).toBe("Size");
    expect(await counts(p)).toEqual({ options: 1, variants: 2 });
    // drop a value a size still uses: refused, the rename of another value is rolled back
    const used: Cfg = { options: [{ ...a.cfg.options[0], values: [{ id: a.s, label: "Small" }] }], variants: a.cfg.variants };
    expect((await save(adminUser, p, used)).error?.code).toBe("23503");
    expect((await svc.from("product_option_values").select("label").eq("id", a.s).single()).data!.label).toBe("S");
    expect(await counts(p)).toEqual({ options: 1, variants: 2 });
  });

  test("the table refuses a size that lacks a value, and a new option on a product whose sizes have values", async () => {
    const p = await bare();
    const o1 = uid(), s = uid(), o2 = uid(), red = uid(), v = uid();
    const cfg: Cfg = {
      options: [
        { id: o1, name: "Size", values: [{ id: s, label: "S" }] },
        { id: o2, name: "Color", values: [{ id: red, label: "Red" }] },
      ],
      variants: [{ id: v, sku: null, is_active: true, values: { [o1]: s, [o2]: red } }],
    };
    expect((await save(adminUser, p, cfg)).error).toBeNull();
    // a value row that leaves the size incomplete
    expect((await svc.from("product_variant_values").delete().eq("variant_id", v).eq("option_id", o2)).error?.message).toMatch(/exactly one value/);
    // a new option after sizes have values
    expect((await svc.from("product_options").insert({ workspace_id: ws, product_id: p, name: "Fit" })).error?.message).toMatch(/exactly one value/);
    expect((await svc.from("product_variant_values").select("option_id").eq("variant_id", v)).data).toHaveLength(2);
  });

  test("a signed-in admin cannot leave a size without values (direct insert, or deleting all its value rows)", async () => {
    const p = await bare();
    const a = sizeCfg();
    expect((await save(adminUser, p, a.cfg)).error).toBeNull();
    const before = await counts(p);
    // a size row on its own is refused at commit
    expect((await adminUser.from("product_variants").insert({ workspace_id: ws, product_id: p }).select("id")).error?.message).toMatch(/exactly one value/);
    // removing every value row of a size is refused too
    expect((await adminUser.from("product_variant_values").delete().eq("variant_id", a.vs).select("variant_id")).error?.message).toMatch(/exactly one value/);
    expect(await counts(p)).toEqual(before);
    expect((await svc.from("product_variant_values").select("variant_id").eq("variant_id", a.vs)).data).toHaveLength(1);
  });

  test("save_variant_config: a value taken from another option is an incomplete size, not in_use", async () => {
    const p = await bare();
    const o1 = uid(), s = uid(), o2 = uid(), red = uid();
    const cfg: Cfg = {
      options: [
        { id: o1, name: "Size", values: [{ id: s, label: "S" }] },
        { id: o2, name: "Color", values: [{ id: red, label: "Red" }] },
      ],
      variants: [{ id: uid(), sku: null, is_active: true, values: { [o1]: red, [o2]: s } }],
    };
    expect((await save(adminUser, p, cfg)).error?.message).toMatch(/incomplete size/);
  });

  // ---- order size changes -------------------------------------------------
  test("size change at reserved (wait_for_deposit): the order moves from size M to L without touching stock", async () => {
    const a = await product(["M", "L"]);
    await buy(a.p, 5);
    const o = await order(a.p, a.variants.M);
    await status(o, "wait_for_deposit");
    const total = await pstock(a.p);
    const heldM = await vstock(a.variants.M);
    // changeOrderVariant cannot be called from vitest: the admin-session update it performs is used instead
    const r = await adminUser.from("orders").update({ variant_id: a.variants.L }).eq("id", o).select("id");
    expect(r.error).toBeNull();
    expect(r.data).toHaveLength(1);
    // D34: reserved is derived per product (00031), there is no per-size reserved count, so no hold moves
    expect(await moves(o)).toEqual([]);
    expect(await vstock(a.variants.M)).toBe(heldM);
    expect(await vstock(a.variants.L)).toBe(0);
    expect(await pstock(a.p)).toBe(total);
    expect((await svc.from("orders").select("variant").eq("id", o).single()).data!.variant).toBe("L");
  });

  test("on-road (bureau_deposited), stop_desk_waiting and delayed: a size change moves the hold; changeOrderVariant (admin update) rewrites the label; a direct patch of the label is rewritten", async () => {
    for (const stage of ["bureau_deposited", "stop_desk_waiting", "delayed"]) {
      const a = await product(["M", "L"]);
      await buy(a.p, 5);
      const o = await order(a.p, a.variants.M);
      await status(o, stage);
      const total = await pstock(a.p);
      const heldM = await vstock(a.variants.M);
      // what the admin action does: an update of variant_id on the session client
      const r = await adminUser.from("orders").update({ variant_id: a.variants.L }).eq("id", o).select("id");
      expect(r.error).toBeNull();
      expect(r.data).toHaveLength(1);
      expect(await vstock(a.variants.M)).toBe(heldM + 2);
      expect(await vstock(a.variants.L)).toBe(-2);
      expect(await pstock(a.p)).toBe(total);
      expect((await svc.from("orders").select("variant").eq("id", o).single()).data!.variant).toBe("L");
      // a direct patch of the label cannot disagree with the size
      expect((await svc.from("orders").update({ variant: "hacked" }).eq("id", o)).error).toBeNull();
      expect((await svc.from("orders").select("variant").eq("id", o).single()).data!.variant).toBe("L");
    }
  });

  // ---- VAR-1: add an option to a product that has sizes (00068) -------------
  /** product with sizes S, M (stock 5 and 3), one order on S */
  async function withSizes() {
    const a = await product(["S", "M"]);
    await buy(a.p, 8);
    await svc.from("product_variants").update({ is_active: false }).eq("id", a.variants.M);
    const ord = await order(a.p, a.variants.S);
    const cfg: Cfg = {
      options: [{ id: a.o, name: "Size", values: [{ id: a.values.S, label: "S" }, { id: a.values.M, label: "M" }] }],
      variants: [
        { id: a.variants.S, sku: "X-S", is_active: true, values: { [a.o]: a.values.S } },
        { id: a.variants.M, sku: null, is_active: false, values: { [a.o]: a.values.M } },
      ],
    };
    return { ...a, cfg, ord };
  }
  const colorOpt = () => {
    const c = uid(), red = uid(), blue = uid();
    return { c, red, blue, opt: { id: c, name: "Color", kind: "color", values: [{ id: red, label: "Red", swatch_color: "#ff0000" }, { id: blue, label: "Blue", swatch_image: "https://cdn.example.com/b.jpg" }] } };
  };

  test("adds a colour option to a product with sizes: backfill, stock, ids, is_active, orders unchanged", async () => {
    const a = await withSizes();
    const k = colorOpt();
    await svc.from("product_variants").update({ stock: 5 }).eq("id", a.variants.S);
    const stockBefore = await vstock(a.variants.S);
    const cfg: Cfg = {
      options: [...a.cfg.options, k.opt],
      variants: a.cfg.variants.map((v, i) => ({ ...v, values: { ...v.values, [k.c]: k.red } })),
      backfill: { [k.c]: k.red },
    };
    const r = await save(adminUser, a.p, cfg);
    expect(r.error).toBeNull();
    const rows = (await svc.from("product_variants").select("id, stock, is_active, sku").eq("product_id", a.p)).data!;
    expect(rows.map((x) => x.id).sort()).toEqual([a.variants.S, a.variants.M].sort());
    expect(await vstock(a.variants.S)).toBe(stockBefore);
    expect(rows.find((x) => x.id === a.variants.M)!.is_active).toBe(false);
    const vv = (await svc.from("product_variant_values").select("variant_id, option_id, value_id").eq("product_id", a.p)).data!;
    expect(vv).toHaveLength(4);
    expect(vv.filter((x) => x.option_id === k.c).every((x) => x.value_id === k.red)).toBe(true);
    expect(vv.find((x) => x.variant_id === a.variants.S && x.option_id === a.o)!.value_id).toBe(a.values.S);
    const o = (await svc.from("orders").select("variant_id, variant").eq("id", a.ord).single()).data!;
    expect(o.variant_id).toBe(a.variants.S);
    expect(o.variant).toBe("S");
    // swatches stored; the label is now "S / Red" for new lookups
    expect((await svc.from("product_option_values").select("swatch_color, swatch_image").eq("id", k.blue).single()).data).toEqual({ swatch_color: null, swatch_image: "https://cdn.example.com/b.jpg" });
    expect((await svc.rpc("variant_label", { p_variant: a.variants.S })).data).toBe("S / Red");
  });

  test("a new option without backfill, or with a bad backfill, is refused as incomplete size and writes nothing", async () => {
    const a = await withSizes();
    const k = colorOpt();
    const other = colorOpt();
    const mk = (backfill: unknown, extra: Partial<Cfg> = {}): Cfg => ({
      options: [...a.cfg.options, k.opt],
      variants: a.cfg.variants.map((v) => ({ ...v, values: { ...v.values, [k.c]: k.red } })),
      backfill,
      ...extra,
    });
    for (const bad of [undefined, {}, "x", [k.red], null, { [a.o]: a.values.S, [k.c]: k.red }, { [k.c]: other.red }, { [k.c]: a.values.S }, { [uid()]: k.red, [k.c]: k.red }, { [k.c]: 5 }]) {
      const r = await save(adminUser, a.p, mk(bad));
      expect(r.error?.message, JSON.stringify(bad)).toBe("incomplete size");
    }
    expect(await counts(a.p)).toEqual({ options: 1, variants: 2 });
    expect((await svc.from("product_variant_values").select("variant_id").eq("product_id", a.p)).data).toHaveLength(2);
  });

  test("backfill: saved sizes, a new option and new sizes in one payload pass; a value-less size is not backfilled", async () => {
    const a = await withSizes();
    const k = colorOpt();
    const nv = uid();
    const cfg: Cfg = {
      options: [{ ...a.cfg.options[0], values: [...a.cfg.options[0].values, { id: uid(), label: "L" }] }, k.opt],
      variants: [
        ...a.cfg.variants.map((v) => ({ ...v, values: { ...v.values, [k.c]: k.red } })),
        { id: nv, sku: null, is_active: true, values: { [a.o]: a.values.S, [k.c]: k.blue } },
      ],
      backfill: { [k.c]: k.red },
    };
    expect((await save(adminUser, a.p, cfg)).error).toBeNull();
    expect(await counts(a.p)).toEqual({ options: 2, variants: 3 });
    expect((await svc.from("product_variant_values").select("value_id").eq("variant_id", nv).eq("option_id", k.c).single()).data!.value_id).toBe(k.blue);
    // a size without value rows (D55 legacy) is left alone by the backfill
    const b = await bare();
    const so = uid(), sv = uid();
    await svc.from("product_options").insert({ id: so, workspace_id: ws, product_id: b, name: "Size" });
    await svc.from("product_option_values").insert({ id: sv, workspace_id: ws, product_id: b, option_id: so, label: "S" });
    const bare1 = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: b }).select("id").single()).data!.id as string;
    const k2 = colorOpt();
    const cfg2: Cfg = { options: [{ id: so, name: "Size", values: [{ id: sv, label: "S" }] }, k2.opt], variants: [{ id: bare1, sku: null, is_active: true, values: { [so]: sv, [k2.c]: k2.red } }], backfill: { [k2.c]: k2.red } };
    expect((await save(adminUser, b, cfg2)).error).toBeNull();
    expect((await svc.from("product_variant_values").select("option_id").eq("variant_id", bare1)).data).toHaveLength(2);
  });

  test("backfill: a value-less size given one of two options' values, another given {}, plus a new option, is refused and nothing changes (D82)", async () => {
    const b = await bare();
    const so = uid(), sv = uid(), po = uid(), pv = uid();
    const ins = await svc.from("product_options").insert([{ id: so, workspace_id: ws, product_id: b, name: "Size", position: 0 }, { id: po, workspace_id: ws, product_id: b, name: "Fit", position: 1 }]);
    expect(ins.error).toBeNull();
    await svc.from("product_option_values").insert([{ id: sv, workspace_id: ws, product_id: b, option_id: so, label: "S" }, { id: pv, workspace_id: ws, product_id: b, option_id: po, label: "Slim" }]);
    const v1 = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: b }).select("id").single()).data!.id as string;
    const v2 = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: b }).select("id").single()).data!.id as string;
    const k = colorOpt();
    const cfg: Cfg = {
      options: [{ id: so, name: "Size", values: [{ id: sv, label: "S" }] }, { id: po, name: "Fit", values: [{ id: pv, label: "Slim" }] }, k.opt],
      variants: [
        { id: v1, sku: null, is_active: true, values: { [so]: sv, [k.c]: k.red } },
        { id: v2, sku: null, is_active: true, values: {} },
      ],
      backfill: { [k.c]: k.red },
    };
    expect((await save(adminUser, b, cfg)).error?.message).toMatch(/incomplete size|exactly one value/);
    expect((await svc.from("product_options").select("id").eq("product_id", b)).data).toHaveLength(2);
    expect((await svc.from("product_variant_values").select("option_id").eq("variant_id", v1)).data).toHaveLength(0);
  });

  test("removing a used VALUE is in_use (23503); removing an option on a product with sizes is stale; without sizes it is free", async () => {
    const a = await withSizes();
    const used: Cfg = { options: [{ ...a.cfg.options[0], values: [{ id: a.values.S, label: "S" }] }], variants: a.cfg.variants };
    expect((await save(adminUser, a.p, used)).error?.code).toBe("23503");
    expect((await save(adminUser, a.p, { options: [], variants: [] })).error?.message).toBe("stale");
    expect(await counts(a.p)).toEqual({ options: 1, variants: 2 });
    const b = await bare();
    const k = colorOpt();
    expect((await save(adminUser, b, { options: [k.opt], variants: [] })).error).toBeNull();
    expect((await save(adminUser, b, { options: [], variants: [] })).error).toBeNull();
    expect(await counts(b)).toEqual({ options: 0, variants: 0 });
  });

  test("swatch rules: bad url or hex, both set, on a text option, two color options are refused", async () => {
    const b = await bare();
    const k = colorOpt();
    const withValue = (extra: Record<string, unknown>, kind = "color"): Cfg => ({ options: [{ id: k.c, name: "Color", kind, values: [{ id: k.red, label: "Red", ...extra }] }], variants: [] });
    for (const bad of ["http://a/x.png", "javascript:alert(1)", "https://a/x.png)", "https://a/x y.png", 'https://a/"x', "https://a/x'", "https://a/<x>", "https://a/\\x"]) {
      expect((await save(adminUser, b, withValue({ swatch_image: bad }))).error, bad).not.toBeNull();
    }
    expect((await save(adminUser, b, withValue({ swatch_color: "red" }))).error).not.toBeNull();
    expect((await save(adminUser, b, withValue({ swatch_color: "#ff0000", swatch_image: "https://a/x.png" }))).error).not.toBeNull();
    expect((await save(adminUser, b, withValue({ swatch_color: "#ff0000" }, "text"))).error?.message).toMatch(/swatch needs a color option/);
    const two: Cfg = { options: [k.opt, { ...colorOpt().opt }], variants: [] };
    expect((await save(adminUser, b, two)).error?.message).toMatch(/product_options_one_color/);
    expect(await counts(b)).toEqual({ options: 0, variants: 0 });
    // kind back to text clears the swatches
    expect((await save(adminUser, b, { options: [k.opt], variants: [] })).error).toBeNull();
    const text: Cfg = { options: [{ id: k.c, name: "Color", kind: "text", values: [{ id: k.red, label: "Red" }, { id: k.blue, label: "Blue" }] }], variants: [] };
    expect((await save(adminUser, b, text)).error).toBeNull();
    expect((await svc.from("product_option_values").select("swatch_color, swatch_image").eq("option_id", k.c)).data!.every((x) => !x.swatch_color && !x.swatch_image)).toBe(true);
  });

  test("an agent cannot call save_variant_config with a backfill; another workspace's product is refused", async () => {
    const a = await withSizes();
    const k = colorOpt();
    const cfg: Cfg = { options: [...a.cfg.options, k.opt], variants: a.cfg.variants.map((v) => ({ ...v, values: { ...v.values, [k.c]: k.red } })), backfill: { [k.c]: k.red } };
    expect((await save(confAgent, a.p, cfg)).error).not.toBeNull();
    const foreign = await withSizes();
    const userWs2 = await userIn(ws2, "admin");
    expect((await save(userWs2, foreign.p, cfg)).error).not.toBeNull();
    expect(await counts(a.p)).toEqual({ options: 1, variants: 2 });
  });

  // ---- size_sets ------------------------------------------------------------
  test("size_sets: admin only, own workspace, unique name per workspace, item checks, no anon", async () => {
    const name = tag();
    const ins = await adminUser.from("size_sets").insert({ workspace_id: ws, name, items: ["S", "M"] }).select("id").single();
    expect(ins.error).toBeNull();
    const id = ins.data!.id as string;
    expect((await adminUser.from("size_sets").insert({ workspace_id: ws, name: name.toUpperCase(), items: ["S"] })).error?.code).toBe("23505");
    for (const items of [[], [" S"], [""], ["a".repeat(61)], Array.from({ length: 41 }, (_, i) => String(i))]) {
      expect((await adminUser.from("size_sets").insert({ workspace_id: ws, name: tag(), items })).error, JSON.stringify(items).slice(0, 30)).not.toBeNull();
    }
    expect((await adminUser.from("size_sets").insert({ workspace_id: ws2, name: tag(), items: ["S"] })).error).not.toBeNull();
    // agent: no read, no write
    expect((await confAgent.from("size_sets").select("id")).data ?? []).toEqual([]);
    expect((await confAgent.from("size_sets").insert({ workspace_id: ws, name: tag(), items: ["S"] })).error).not.toBeNull();
    expect((await confAgent.from("size_sets").update({ name: "x" }).eq("id", id).select("id")).data ?? []).toEqual([]);
    expect((await confAgent.from("size_sets").delete().eq("id", id).select("id")).data ?? []).toEqual([]);
    expect((await anon.from("size_sets").select("id")).error).not.toBeNull();
    // other workspace's admin sees nothing; workspace_id cannot be moved
    const other = await userIn(ws2, "admin");
    expect((await other.from("size_sets").select("id").eq("id", id)).data ?? []).toEqual([]);
    expect((await adminUser.from("size_sets").update({ workspace_id: ws2 }).eq("id", id)).error).not.toBeNull();
    expect((await adminUser.from("size_sets").delete().eq("id", id).select("id")).data).toHaveLength(1);
  });

  // ---- 00070 hardening ------------------------------------------------------
  test("00070: no role can change an existing product_variant_values row (update and upsert paths)", async () => {
    // Built by hand: a second option must exist before any size does. 3 Size values, 2 sizes, so value L
    // is used by no size and the older uniqueness triggers cannot be what refuses the change.
    const ins = async (table: string, r: Record<string, unknown>) => {
      const x = await svc.from(table).insert({ workspace_id: ws, ...r }).select("id").single();
      expect(x.error, table).toBeNull();
      return x.data!.id as string;
    };
    const p = await ins("products", { name: tag() });
    const o = await ins("product_options", { product_id: p, name: "Size", position: 0 });
    const o2 = await ins("product_options", { product_id: p, name: "Color", position: 1 });
    const val = (option_id: string, label: string, position: number) => ins("product_option_values", { product_id: p, option_id, label, position });
    const [S, M, L] = [await val(o, "S", 0), await val(o, "M", 1), await val(o, "L", 2)];
    const [red, blue] = [await val(o2, "Red", 0), await val(o2, "Blue", 1)];
    const vS = await ins("product_variants", { product_id: p });
    const vM = await ins("product_variants", { product_id: p });
    const jv = (variant_id: string, option_id: string, value_id: string) => ({ variant_id, option_id, value_id, product_id: p, workspace_id: ws });
    expect((await svc.from("product_variant_values").insert([jv(vS, o, S), jv(vS, o2, red), jv(vM, o, M), jv(vM, o2, blue)])).error).toBeNull();
    const spare = await ins("product_variants", { product_id: p });
    const row = (over: Record<string, string>) => ({ variant_id: vS, option_id: o, value_id: S, product_id: p, workspace_id: ws, ...over });
    const changes: Record<string, Record<string, string>> = {
      value_id: { value_id: L },
      option_id: { option_id: o2, value_id: blue }, // conflicts with S's Color row (Red): upsert turns into a value change
      variant_id: { variant_id: spare },
    };
    try {
      for (const who of [svc, adminUser]) {
        for (const [name, over] of Object.entries(changes)) {
          const upd = await who.from("product_variant_values").update(over).eq("variant_id", vS).eq("option_id", o);
          expect(upd.error?.message, `update ${name}`).toMatch(/immutable/);
          if (name === "variant_id") continue; // the upsert key itself changes: not a conflict path
          const ups = await who.from("product_variant_values").upsert(row(over), { onConflict: "variant_id,option_id" });
          expect(ups.error?.message, `upsert ${name}`).toMatch(/immutable/);
        }
      }
      expect(() => psql(`update public.product_variant_values set value_id = '${L}' where variant_id = '${vS}';`)).toThrow(/immutable/);
      const { data } = await svc.from("product_variant_values").select("value_id, option_id, variant_id").eq("variant_id", vS).eq("option_id", o).single();
      expect(data).toEqual({ value_id: S, option_id: o, variant_id: vS });
    } finally {
      // the value-less size must not outlive the test: the 00070 guard test counts them
      expect((await svc.from("product_variants").delete().eq("id", spare)).error).toBeNull();
    }
  });

  test("00070: authenticated lost TRUNCATE/TRIGGER/REFERENCES and keeps SELECT/INSERT/UPDATE/DELETE on the four variant tables", () => {
    for (const t of ["product_options", "product_option_values", "product_variants", "product_variant_values"]) {
      const has = (priv: string) => psql(`select has_table_privilege('authenticated','public.${t}','${priv}');`).trim();
      for (const priv of ["TRUNCATE", "TRIGGER", "REFERENCES"]) expect(has(priv)).toBe("f");
      for (const priv of ["SELECT", "INSERT", "UPDATE", "DELETE"]) expect(has(priv)).toBe("t");
    }
  });

  test("00070: an admin product delete still commits with variants present", async () => {
    const a = await product(["S", "M"]);
    const del = await adminUser.from("products").delete().eq("id", a.p).select("id");
    expect(del.error).toBeNull();
    expect(del.data).toHaveLength(1);
  });

  test("00070: zod refuses a size with no values (variant_values), with or without options", async () => {
    const { variantConfigSchema } = await import("@/lib/variants");
    const id = () => crypto.randomUUID();
    const o = { id: id(), name: "Size", values: [{ id: id(), label: "S" }] };
    const bare = { id: id(), sku: null, is_active: true, values: {} };
    for (const cfg of [{ options: [o], variants: [bare] }, { options: [], variants: [bare] }]) {
      const r = variantConfigSchema.safeParse(cfg);
      expect(r.success).toBe(false);
      expect(!r.success && r.error.issues.some((i) => i.message === "variant_values")).toBe(true);
    }
  });

  const guardSql = () => {
    const sql = readFileSync("supabase/migrations/00070_variant_values_hardening.sql", "utf8");
    const guard = sql.slice(sql.indexOf("-- guard:begin"), sql.indexOf("-- guard:end"));
    expect(guard).toContain("raise exception");
    return guard;
  };
  const noValues = "select count(*) from public.product_variants v where not exists (select 1 from public.product_variant_values x where x.variant_id = v.id)";
  const addBare = (w: string) => `with p as (insert into products(workspace_id, name) values ('${w}', 'guard-${crypto.randomUUID()}') returning id)
      insert into product_variants(workspace_id, product_id) select '${w}', id from p;`;

  test("00070 guard: refuses a value-less size in any workspace, deletes nothing; count is pre-count + 2", () => {
    const guard = guardSql();
    // one snapshot transaction: concurrent suites cannot move the count between pre and post
    const run = `begin isolation level repeatable read;
      select 'pre=' || (${noValues});
      ${addBare(ws)}
      ${addBare(ws2)}
      savepoint g;
      ${guard}
      rollback;`;
    let out = "";
    let msg = "";
    try {
      out = psql(run);
    } catch (e) {
      const err = e as { stdout?: unknown; stderr?: unknown };
      out = String(err.stdout ?? "");
      msg = String(err.stderr ?? e);
    }
    const pre = Number(out.match(/pre=(\d+)/)?.[1]);
    const m = msg.match(/guard: (\d+) size\(s\) have no value rows/);
    expect(Number.isNaN(pre), out + msg).toBe(false);
    expect(m, msg).not.toBeNull();
    expect(Number(m![1])).toBe(pre + 2);
  });

  test("00070 guard: clean data (guard scoped to a fresh workspace, no deletes) does not throw", () => {
    const fresh = crypto.randomUUID();
    const guard = guardSql().replace("where not exists", `where v.workspace_id = '${fresh}' and not exists`);
    expect(guard).toContain(`v.workspace_id = '${fresh}'`);
    expect(() => psql(`begin;\ninsert into workspaces(id, name) values ('${fresh}', 'clean-${fresh}');\n${guard}\nrollback;`)).not.toThrow();
  });

  test("00070: anon and PUBLIC lack TRUNCATE/TRIGGER/REFERENCES on the four variant tables", () => {
    for (const t of ["product_options", "product_option_values", "product_variants", "product_variant_values"]) {
      for (const priv of ["TRUNCATE", "TRIGGER", "REFERENCES"]) {
        expect(psql(`select has_table_privilege('anon','public.${t}','${priv}');`).trim(), `anon ${t} ${priv}`).toBe("f");
        expect(
          psql(`select exists (select 1 from information_schema.role_table_grants where grantee='PUBLIC' and table_schema='public' and table_name='${t}' and privilege_type='${priv}');`).trim(),
          `PUBLIC ${t} ${priv}`,
        ).toBe("f");
      }
    }
  });
});
