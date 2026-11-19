import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { buildPricingPayload } from "@/lib/store/selling-schemas";
import { deleteWorkspaces } from "@/lib/test-cleanup";

/** Live STORE-3 checks: offers, forms and price columns (grants, RLS, integrity). */
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

describe.skipIf(!URL)("offers, forms, price columns (live DB)", () => {
  let svc: SupabaseClient;
  let anon: SupabaseClient;
  let adminA: SupabaseClient;
  let agent: SupabaseClient;
  let ws: string;
  let ws2: string;
  const users: string[] = [];
  const tag = () => `o${crypto.randomUUID().slice(0, 8)}`;

  async function userIn(workspace: string, role: "admin" | "confirmation_agent") {
    const email = `st3-${role}-${crypto.randomUUID()}@test.mnw`;
    const { data, error } = await svc.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);
    const up = await svc.from("profiles").update({ workspace_id: workspace, role, is_active: true }).eq("user_id", data.user.id);
    expect(up.error).toBeNull();
    return signIn(email);
  }
  const product = async (workspace = ws, extra: Record<string, unknown> = { sale_price: 5000 }) =>
    (await svc.from("products").insert({ workspace_id: workspace, name: tag(), ...extra }).select("id").single()).data!.id as string;
  const offer = (p: string, extra: Record<string, unknown> = {}, c: SupabaseClient = svc) =>
    c.from("product_offers").insert({ workspace_id: ws, product_id: p, kind: "quantity", label: "x2", qty: 2, total_price: 9000, ...extra }).select("id").single();

  beforeAll(async () => {
    svc = client(SERVICE_KEY);
    anon = client(ANON_KEY);
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    ws2 = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
    adminA = await userIn(ws, "admin");
    agent = await userIn(ws, "confirmation_agent");
  });
  afterAll(async () => {
    if (!svc) return;
    const wss = [ws, ws2].filter(Boolean);
    await svc.from("product_offers").delete().in("workspace_id", wss);
    await svc.from("product_forms").delete().in("workspace_id", wss);
    await svc.from("product_variant_values").delete().in("workspace_id", wss);
    await svc.from("product_option_values").delete().in("workspace_id", wss);
    await svc.from("product_options").delete().in("workspace_id", wss);
    expect((await deleteWorkspaces(svc, wss)).error).toBeNull();
    for (const id of users) await svc.auth.admin.deleteUser(id);
  });

  test("anon no grant; no authenticated truncate/trigger/references", async () => {
    for (const t of ["product_offers", "product_forms"] as const) {
      expect((await anon.from(t).select("*")).error).not.toBeNull();
    }
    const out = psql(`select count(*) from information_schema.role_table_grants
      where table_schema='public' and table_name in ('product_offers','product_forms')
      and (grantee='anon' or (grantee='authenticated' and privilege_type in ('TRUNCATE','TRIGGER','REFERENCES')))`);
    expect(out.trim()).toBe("0");
  });

  test("agent cannot write offers/forms/price columns, can read offers", async () => {
    const p = await product();
    const o = (await offer(p)).data!;
    expect((await agent.from("product_offers").select("id").eq("id", o.id)).data).toHaveLength(1);
    expect((await offer(p, { label: "y", qty: 3 }, agent)).error).not.toBeNull();
    expect((await agent.from("product_offers").update({ label: "hack" }).eq("id", o.id).select("id")).data ?? []).toEqual([]);
    expect((await agent.from("product_offers").delete().eq("id", o.id).select("id")).data ?? []).toEqual([]);
    expect((await agent.from("product_forms").insert({ workspace_id: ws, product_id: p })).error).not.toBeNull();
    expect((await agent.from("products").update({ pricing_mode: "per_value", compare_at_price: 1 }).eq("id", p).select("id")).data ?? []).toEqual([]);
    expect((await adminA.from("product_offers").update({ label: "ok" }).eq("id", o.id).select("id")).data).toHaveLength(1);
    expect((await adminA.from("product_forms").insert({ workspace_id: ws, product_id: p }).select("product_id")).data).toHaveLength(1);
    const f = await adminA.from("product_forms").select("fields, delivery_methods").eq("product_id", p).single();
    expect(f.data).toEqual({ fields: [], delivery_methods: ["home", "stopdesk"] });
  });

  test("offer checks: qty range, positive total, window, label length, no free_delivery column", async () => {
    const p = await product();
    expect((await offer(p, { qty: 1 })).error).not.toBeNull();
    expect((await offer(p, { qty: 51 })).error).not.toBeNull();
    expect((await offer(p, { total_price: 0 })).error).not.toBeNull();
    expect((await offer(p, { label: "x".repeat(61) })).error).not.toBeNull();
    expect((await offer(p, { active_from: "2026-02-01T00:00:00Z", active_to: "2026-01-01T00:00:00Z" })).error).not.toBeNull();
    expect((await offer(p, { free_delivery: true })).error).not.toBeNull();
    expect((await offer(p, { qty: 3 })).error).toBeNull();
  });

  test("one default offer per product", async () => {
    const p = await product();
    expect((await offer(p, { is_default: true })).error).toBeNull();
    expect((await offer(p, { qty: 3, is_default: true })).error).not.toBeNull();
    expect((await offer(p, { qty: 3 })).error).toBeNull();
  });

  test("bump rules (self, other ws, sized, deleted, unpriced)", async () => {
    const p = await product();
    const bump = (b: string | null, extra: Record<string, unknown> = {}) =>
      svc.from("product_offers").insert({ workspace_id: ws, product_id: p, kind: "bump", label: "bump", bump_product_id: b, bump_price: 1000, ...extra }).select("id").single();
    expect((await bump(p)).error).not.toBeNull();
    expect((await bump(await product(ws2))).error).not.toBeNull();
    expect((await bump(await product(ws, { sale_price: null }))).error).not.toBeNull();
    const sized = await product();
    await svc.from("product_variants").insert({ workspace_id: ws, product_id: sized });
    expect((await bump(sized)).error).not.toBeNull();
    expect((await bump(await product(), { bump_price: -1 })).error).not.toBeNull();
    const ok = await product();
    const row = (await bump(ok)).data!;
    expect((await bump(await product())).error).not.toBeNull(); // one bump per product
    await svc.from("products").delete().eq("id", ok);
    const after = await svc.from("product_offers").select("bump_product_id").eq("id", row.id).single();
    expect(after.data).toEqual({ bump_product_id: null });
  });

  test("saving per_value with a delta, then uniform, leaves every price_delta at 0", async () => {
    const p = await product();
    const opt = (await svc.from("product_options").insert({ workspace_id: ws, product_id: p, name: "Size" }).select("id").single()).data!.id;
    const val = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: p, option_id: opt, label: "XL" }).select("id").single()).data!.id;
    // same writes as savePricing, on an admin session, with the editor's payload
    const save = async (mode: "per_value" | "uniform") => {
      const pl = buildPricingPayload({ productId: p, mode, compareAt: null, deltas: { [val]: 300 }, overrides: {}, variantIds: [] });
      for (const d of pl.deltas) expect((await adminA.from("product_option_values").update({ price_delta: d.delta }).eq("id", d.valueId).eq("product_id", p)).error).toBeNull();
      expect((await adminA.from("products").update({ pricing_mode: pl.mode }).eq("id", p)).error).toBeNull();
    };
    const deltas = async () => (await svc.from("product_option_values").select("price_delta").eq("product_id", p)).data!.map((r) => Number(r.price_delta));
    await save("per_value");
    expect(await deltas()).toEqual([300]);
    await save("uniform");
    expect(await deltas()).toEqual([0]);
  });

  test("forms: fields size, delivery methods", async () => {
    const p = await product();
    const ins = (extra: Record<string, unknown>) => svc.from("product_forms").upsert({ workspace_id: ws, product_id: p, ...extra });
    expect((await ins({ delivery_methods: [] })).error).not.toBeNull();
    expect((await ins({ delivery_methods: ["air"] })).error).not.toBeNull();
    expect((await ins({ fields: { a: 1 } })).error).not.toBeNull();
    expect((await ins({ fields: [{ label: "x".repeat(17000) }] })).error).not.toBeNull();
    expect((await ins({ delivery_methods: ["home"] })).error).toBeNull();
  });

  test("price column checks and variant price audit", async () => {
    const p = await product();
    expect((await svc.from("products").update({ pricing_mode: "weird" }).eq("id", p)).error).not.toBeNull();
    // product save with sale price above compare price stays allowed
    expect((await svc.from("products").update({ compare_at_price: 1000, sale_price: 5000 }).eq("id", p)).error).toBeNull();
    const o = (await svc.from("product_options").insert({ workspace_id: ws, product_id: p, name: "Size" }).select("id").single()).data!.id;
    expect((await svc.from("product_option_values").insert({ workspace_id: ws, product_id: p, option_id: o, label: "M", price_delta: 1.5 })).error).not.toBeNull();
    expect((await svc.from("product_option_values").insert({ workspace_id: ws, product_id: p, option_id: o, label: "L", price_delta: -500 })).error).toBeNull();
    const v = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: p }).select("id").single()).data!.id;
    expect((await svc.from("product_variants").update({ price_override: -1 }).eq("id", v)).error).not.toBeNull();
    expect((await svc.from("product_variants").update({ price_override: 4200 }).eq("id", v)).error).toBeNull();
    const log = psql(`select count(*) from audit_log where table_name='product_variants' and row_id='${v}'`);
    expect(Number(log.trim())).toBe(1);
  });

  test("save_variant_config keeps prices", async () => {
    const p = await product();
    const o = (await svc.from("product_options").insert({ workspace_id: ws, product_id: p, name: "Size" }).select("id").single()).data!.id;
    const val = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: p, option_id: o, label: "M", price_delta: 300 }).select("id").single()).data!.id;
    const v = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: p, price_override: 4200 }).select("id").single()).data!.id;
    await svc.from("product_variant_values").insert({ workspace_id: ws, product_id: p, variant_id: v, option_id: o, value_id: val });
    const cfg = { options: [{ id: o, name: "Size", values: [{ id: val, label: "M" }] }], variants: [{ id: v, sku: "S1", is_active: true, values: { [o]: val } }] };
    const r = await adminA.rpc("save_variant_config", { p_product: p, p_config: cfg });
    expect(r.error).toBeNull();
    expect((await svc.from("product_variants").select("price_override, sku").eq("id", v).single()).data).toEqual({ price_override: 4200, sku: "S1" });
    expect((await svc.from("product_option_values").select("price_delta").eq("id", val).single()).data).toEqual({ price_delta: 300 });
  });
});
