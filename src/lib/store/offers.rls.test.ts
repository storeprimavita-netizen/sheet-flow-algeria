import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { updateTag } from "next/cache";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { saveForm, saveOffers, savePricing } from "@/app/(app)/app/catalog/products/[id]/selling/actions";
import { requireAdminProfile } from "@/lib/rbac";
import { buildPricingPayload } from "@/lib/store/selling-schemas";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { deleteWorkspaces } from "@/lib/test-cleanup";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }));
vi.mock("@/lib/rbac", () => ({ requireAdminProfile: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

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
  let adminB: SupabaseClient;
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
    adminB = await userIn(ws2, "admin");
    agent = await userIn(ws, "confirmation_agent");
    vi.mocked(requireAdminProfile).mockResolvedValue({ workspaceId: ws } as Awaited<ReturnType<typeof requireAdminProfile>>);
    vi.mocked(createServerClient).mockResolvedValue(adminA);
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

  test("live savePricing clears every delta when switching from per_value to uniform or per_variant", async () => {
    const p = await product();
    const opt = (await svc.from("product_options").insert({ workspace_id: ws, product_id: p, name: "Size" }).select("id").single()).data!.id;
    const values = await svc.from("product_option_values").insert(["L", "XL"].map((label) => ({ workspace_id: ws, product_id: p, option_id: opt, label }))).select("id");
    expect(values.error).toBeNull();
    const deltas = Object.fromEntries(values.data!.map((value, index) => [value.id, 300 + index * 100]));
    const save = async (mode: "per_value" | "uniform" | "per_variant") => {
      vi.mocked(updateTag).mockClear();
      const input = buildPricingPayload({ productId: p, mode, compareAt: null, deltas, overrides: {}, variantIds: [] });
      expect(await savePricing(input)).toEqual({ ok: true });
      expect(updateTag).toHaveBeenCalledExactlyOnceWith("store-public");
    };
    const readDeltas = async () => (await svc.from("product_option_values").select("price_delta").eq("product_id", p).order("price_delta")).data!.map((r) => Number(r.price_delta));
    for (const next of ["uniform", "per_variant"] as const) {
      await save("per_value");
      expect(await readDeltas()).toEqual([300, 400]);
      await save(next);
      expect(await readDeltas()).toEqual([0, 0]);
    }
  });

  test("pricing refuses stale, foreign and fractional rows before changing any price", async () => {
    const p = await product();
    const sameWorkspaceProduct = await product();
    const foreignProduct = await product(ws2);
    const optionValue = async (productId: string, workspaceId: string) => {
      const { data: option } = await svc.from("product_options").insert({ workspace_id: workspaceId, product_id: productId, name: "Size" }).select("id").single();
      const { data } = await svc.from("product_option_values").insert({ workspace_id: workspaceId, product_id: productId, option_id: option!.id, label: "M" }).select("id").single();
      return data!.id as string;
    };
    const local = await optionValue(p, ws);
    const other = await optionValue(sameWorkspaceProduct, ws);
    const outside = await optionValue(foreignProduct, ws2);
    const { data: variant } = await svc.from("product_variants").insert({ workspace_id: ws, product_id: p, price_override: 4500, compare_at_override: 6500 }).select("id").single();
    const { data: outsideVariant } = await svc.from("product_variants").insert({ workspace_id: ws2, product_id: foreignProduct }).select("id").single();
    const args = { p_product: p, p_mode: "per_value", p_compare_at: 6000, p_deltas: [{ valueId: local, delta: 300 }], p_overrides: [] };
    for (const valueId of [other, outside, crypto.randomUUID()]) {
      const res = await adminA.rpc("save_product_pricing", { ...args, p_deltas: [...args.p_deltas, { valueId, delta: 200 }] });
      expect(res.error?.code).toBe("22023");
    }
    expect((await adminA.rpc("save_product_pricing", { ...args, p_deltas: [...args.p_deltas, { valueId: local, delta: 200 }] })).error?.code).toBe("22023");
    expect((await adminA.rpc("save_product_pricing", { ...args, p_deltas: [{ valueId: local, delta: 1.5 }] })).error?.code).toBe("22023");
    expect((await adminA.rpc("save_product_pricing", {
      ...args,
      p_overrides: [{ variantId: outsideVariant!.id, price: 5000, compareAt: null }],
    })).error?.code).toBe("22023");
    expect((await svc.from("product_option_values").select("price_delta").eq("id", local).single()).data).toEqual({ price_delta: 0 });
    expect((await svc.from("products").select("pricing_mode, compare_at_price").eq("id", p).single()).data).toEqual({ pricing_mode: "uniform", compare_at_price: null });
    expect((await svc.from("product_variants").select("price_override, compare_at_override").eq("id", variant!.id).single()).data).toEqual({ price_override: 4500, compare_at_override: 6500 });
    expect((await adminA.rpc("save_product_pricing", args)).error).toBeNull();
    expect((await svc.from("product_variants").select("price_override, compare_at_override").eq("id", variant!.id).single()).data).toEqual({ price_override: null, compare_at_override: null });
  });

  const quantityRow = (label: string, id: string | null = null, isDefault = false) => ({
    id, label, isDefault, qty: 2, total: 9000, isActive: true, activeFrom: null, activeTo: null,
  });

  test("offer saves return stable IDs and roll back the list if the bump fails", async () => {
    const p = await product();
    const bump = { productId: await product(), label: "Bump", price: 1000, isActive: true };
    const original = [quantityRow("First offer", null, true), quantityRow("Second offer")];
    vi.mocked(updateTag).mockClear();
    const first = await saveOffers({ productId: p, offers: original, bump });
    expect(first.ok).toBe(true);
    expect(updateTag).toHaveBeenCalledExactlyOnceWith("store-public");
    if (!first.ok) return;
    const [firstId, secondId] = first.offerIds;
    const savedBump = () => svc.from("product_offers").select("id, label").eq("product_id", p).eq("kind", "bump").single();
    const bumpId = (await savedBump()).data!.id;
    const reorder = [quantityRow("Second changed", secondId, true), quantityRow("First changed", firstId)];
    const second = await saveOffers({ productId: p, offers: reorder, bump: { ...bump, label: "Updated bump" } });
    expect(second).toEqual({ ok: true, offerIds: [secondId, firstId] });
    expect((await savedBump()).data).toEqual({ id: bumpId, label: "Updated bump" });
    vi.mocked(updateTag).mockClear();
    expect(await saveOffers({ productId: p, offers: [quantityRow("Rejected")], bump: { ...bump, productId: p } })).toEqual({ ok: false, error: "bump" });
    expect(updateTag).not.toHaveBeenCalled();
    const current = await svc.from("product_offers").select("id, label, is_default").eq("product_id", p).eq("kind", "quantity").order("position");
    expect(current.data).toEqual([{ id: secondId, label: "Second changed", is_default: true }, { id: firstId, label: "First changed", is_default: false }]);
    expect((await savedBump()).data).toEqual({ id: bumpId, label: "Updated bump" });
  });

  test("offer saves reject invalid row ownership and serialize simultaneous saves", async () => {
    const p = await product();
    const bumpId = (await svc.from("product_offers").insert({
      workspace_id: ws, product_id: p, kind: "bump", label: "Bump", bump_product_id: await product(), bump_price: 500,
    }).select("id").single()).data!.id;
    const other = (await offer(await product())).data!.id;
    const outside = (await offer(await product(ws2), { workspace_id: ws2 })).data!.id;
    const replace = (p_offers: ReturnType<typeof quantityRow>[]) => adminA.rpc("save_product_offers", { p_product: p, p_offers, p_bump: null });
    for (const id of [bumpId, other, outside, crypto.randomUUID()]) {
      expect((await replace([quantityRow("Rejected", id)])).error?.code).toBe("22023");
    }
    expect((await replace([{ ...quantityRow("Rejected"), qty: 2.5 }])).error?.code).toBe("22023");
    expect((await replace([{ ...quantityRow("Rejected"), total: 10000001 }])).error?.code).toBe("22023");
    const initial = await replace([quantityRow("Keep")]);
    expect(initial.error).toBeNull();
    const keepId = initial.data![0];
    const [left, right] = await Promise.all([
      replace([quantityRow("Left", keepId, true), quantityRow("Left new")]),
      replace([quantityRow("Right", keepId, true), quantityRow("Right new")]),
    ]);
    expect(left.error).toBeNull();
    expect(right.error).toBeNull();
    const { data } = await svc.from("product_offers").select("id, label, is_default").eq("product_id", p).order("position");
    expect(data).toHaveLength(2);
    expect(data?.[0].id).toBe(keepId);
    expect(data?.map((row) => row.is_default)).toEqual([true, false]);
    expect([["Left", "Left new"], ["Right", "Right new"]]).toContainEqual(data?.map((row) => row.label));
  });

  test("selling RPCs reject sessions without an admin role on the product workspace", async () => {
    const p = await product();
    for (const c of [anon, agent, adminB]) {
      expect((await c.rpc("save_product_pricing", { p_product: p, p_mode: "per_value", p_deltas: [], p_overrides: [] })).error).not.toBeNull();
      expect((await c.rpc("save_product_offers", { p_product: p, p_offers: [quantityRow("Qty")], p_bump: null })).error).not.toBeNull();
    }
    expect((await svc.from("products").select("pricing_mode").eq("id", p).single()).data).toEqual({ pricing_mode: "uniform" });
    expect((await svc.from("product_offers").select("id").eq("product_id", p)).data).toEqual([]);
  });

  test("selling actions refresh the public cache only after a successful write", async () => {
    const p = await product();
    const form = { productId: p, fields: [], deliveryMethods: ["home"] };
    vi.mocked(updateTag).mockClear();
    expect(await saveForm(form)).toEqual({ ok: true });
    expect(updateTag).toHaveBeenCalledExactlyOnceWith("store-public");
    vi.mocked(updateTag).mockClear();
    expect(await saveForm({ ...form, productId: await product(ws2) })).toEqual({ ok: false, error: "notFound" });
    expect(await saveOffers({ productId: p, offers: [quantityRow("Removed row", crypto.randomUUID())], bump: null })).toEqual({ ok: false, error: "failed" });
    expect(await savePricing({ productId: p, mode: "per_value", compareAt: null, deltas: [{ valueId: crypto.randomUUID(), delta: 1 }], overrides: [] })).toEqual({ ok: false, error: "failed" });
    expect(updateTag).not.toHaveBeenCalled();
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

  test("concurrent option replacement and pricing resolve in one product lock order", async () => {
    const p = await product();
    const optionId = crypto.randomUUID();
    const original = crypto.randomUUID();
    const replacement = crypto.randomUUID();
    const config = (id: string) => ({
      p_product: p,
      p_config: { options: [{ id: optionId, name: "Size", values: [{ id, label: "M" }] }], variants: [] },
    });
    expect((await adminA.rpc("save_variant_config", config(original))).error).toBeNull();
    const [variantConfig, pricing] = await Promise.all([
      adminA.rpc("save_variant_config", config(replacement)),
      adminA.rpc("save_product_pricing", {
        p_product: p, p_mode: "per_value", p_compare_at: 5500,
        p_deltas: [{ valueId: original, delta: 300 }], p_overrides: [],
      }),
    ]);
    expect(variantConfig.error).toBeNull();
    expect((await svc.from("product_option_values").select("id, price_delta").eq("product_id", p)).data)
      .toEqual([{ id: replacement, price_delta: 0 }]);
    const { data: price } = await svc.from("products").select("pricing_mode, compare_at_price").eq("id", p).single();
    if (pricing.error) {
      expect(pricing.error.code).toBe("22023");
      expect(price).toEqual({ pricing_mode: "uniform", compare_at_price: null });
    } else {
      expect(price).toEqual({ pricing_mode: "per_value", compare_at_price: 5500 });
    }
  });
});
