import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import type { Database } from "@/lib/supabase/database.types";
import { deleteWorkspaces } from "@/lib/test-cleanup";

import { loadPublicProductPage } from "./data";

const URL = process.env.LOCAL_SUPABASE_URL;
const SERVICE_KEY =
  process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

describe.skipIf(!URL)("public product page DAL (live DB)", () => {
  let svc: SupabaseClient<Database>;
  let ws: string;
  const tag = () => `s${crypto.randomUUID().slice(0, 8)}`;

  async function setup(over: { store?: Record<string, unknown>; page?: Record<string, unknown>; product?: Record<string, unknown> } = {}) {
    const store = (await svc.from("stores").insert({ workspace_id: ws, slug: tag(), name: "Luxe", status: "live", settings: { whatsapp: "213550000000", phone: "0550" }, ...over.store }).select("id, slug").single()).data!;
    const product = (await svc.from("products").insert({ workspace_id: ws, name: "عباية ✨", sale_price: 5000, is_active: true, images: ["https://x.com/a.jpg", "http://x.com/b.jpg"], ...over.product }).select("id").single()).data!;
    const page = (await svc.from("store_pages").insert({ workspace_id: ws, store_id: store.id, product_id: product.id, slug: "abaya", title: "Abaya", status: "published", blocks: [{ type: "text", text: "hi" }], ...over.page }).select("id").single()).data!;
    return { store, product, page };
  }

  beforeAll(async () => {
    svc = createClient<Database>(URL!, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    ws = (await svc.from("workspaces").insert({ name: tag() }).select("id").single()).data!.id;
  });
  afterAll(async () => {
    if (!svc) return;
    await svc.from("product_offers").delete().eq("workspace_id", ws);
    await svc.from("product_forms").delete().eq("workspace_id", ws);
    await svc.from("store_pages").delete().eq("workspace_id", ws);
    await svc.from("stores").delete().eq("workspace_id", ws);
    await deleteWorkspaces(svc, [ws]);
  });

  test("published page renders; DTO key-set snapshot (nested variants)", async () => {
    const { store, product } = await setup();
    const o = (await svc.from("product_options").insert({ workspace_id: ws, product_id: product.id, name: "Size" }).select("id").single()).data!.id;
    const v = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: product.id, option_id: o, label: "M" }).select("id").single()).data!.id;
    const x = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: product.id, sku: "SECRET" }).select("id").single()).data!.id;
    await svc.from("product_variant_values").insert({ variant_id: x, option_id: o, value_id: v, product_id: product.id, workspace_id: ws });
    const dto = await loadPublicProductPage(svc, store.slug, "abaya");
    expect(dto).not.toBeNull();
    expect(Object.keys(dto!).sort()).toEqual(["bump", "form", "offers", "page", "product", "related", "store", "variants"]);
    expect(Object.keys(dto!.store).sort()).toEqual(["name", "settings", "slug", "theme"]);
    expect(Object.keys(dto!.page).sort()).toEqual(["blocks", "seo", "slug", "title"]);
    expect(Object.keys(dto!.product).sort()).toEqual(["compareAt", "images", "name", "price", "priceFrom", "pricingMode"]);
    expect(dto!.variants).toEqual([{ id: x, label: "M", inStock: false, price: 5000, compareAt: null }]);
    expect(Object.keys(dto!.variants[0]).sort()).toEqual(["compareAt", "id", "inStock", "label", "price"]);
    expect(Object.keys(dto!.form).sort()).toEqual(["deliveryMethods", "fields"]);
    expect(dto!.product.name).toBe("عباية");
    expect(dto!.product.images).toEqual(["https://x.com/a.jpg"]); // DAL drops non-https image
    expect(JSON.stringify(dto)).not.toMatch(/SECRET|workspace_id|cost|free_delivery|"sku"|"stock"/);
  });

  test("variant stock change shows; uncounted product keeps every size in stock (D54.4)", async () => {
    const { store, product } = await setup();
    const o = (await svc.from("product_options").insert({ workspace_id: ws, product_id: product.id, name: "Size" }).select("id").single()).data!.id;
    const mk = async (label: string) => {
      const v = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: product.id, option_id: o, label }).select("id").single()).data!.id;
      const x = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: product.id, sku: `S-${label}` }).select("id").single()).data!.id;
      await svc.from("product_variant_values").insert({ variant_id: x, option_id: o, value_id: v, product_id: product.id, workspace_id: ws });
      return x;
    };
    const m = await mk("M");
    await mk("L");
    const stock = async () => (await loadPublicProductPage(svc, store.slug, "abaya"))!.variants.map((v) => [v.label, v.inStock]).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
    const move = async (delta: number, variantId?: string) => {
      const { error } = await svc.from("stock_movements").insert({ workspace_id: ws, product_id: product.id, variant_id: variantId ?? null, delta, reason: "purchase" });
      expect(error).toBeNull();
    };
    // 10 pieces on the product, none counted per size: nothing is out
    await move(10);
    expect(await stock()).toEqual([["M", true], ["L", true]]);
    // M counted at 10 (moved from not assigned: the product total stays 10): nothing unassigned left, L is out
    await move(-10);
    await move(10, m);
    expect(await stock()).toEqual([["M", true], ["L", false]]);
    // M sells out
    await move(-10, m);
    expect(await stock()).toEqual([["M", false], ["L", false]]);
  });

  async function sizes(labels: string[]) {
    const { store, product } = await setup();
    const o = (await svc.from("product_options").insert({ workspace_id: ws, product_id: product.id, name: "Size" }).select("id").single()).data!.id;
    const ids: Record<string, string> = {};
    for (const label of labels) {
      const v = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: product.id, option_id: o, label }).select("id").single()).data!.id;
      const x = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: product.id, sku: `S-${label}` }).select("id").single()).data!.id;
      await svc.from("product_variant_values").insert({ variant_id: x, option_id: o, value_id: v, product_id: product.id, workspace_id: ws });
      ids[label] = x;
    }
    const move = async (delta: number, variantId?: string) => {
      const { error } = await svc.from("stock_movements").insert({ workspace_id: ws, product_id: product.id, variant_id: variantId ?? null, delta, reason: "purchase" });
      expect(error).toBeNull();
    };
    const stock = async () => (await loadPublicProductPage(svc, store.slug, "abaya"))!.variants.map((v) => [v.label, v.inStock]).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
    return { ids, move, stock, store };
  }

  test("not assigned below zero never hides a counted size (D58a)", async () => {
    const { ids, move, stock } = await sizes(["M", "L"]);
    await move(10);
    await move(-10);
    await move(5, ids.M);
    await move(5, ids.L);
    await move(-8); // an old order ships after the count: not assigned = -8
    expect(await stock()).toEqual([["M", true], ["L", true]]);
    await move(-5, ids.M); // M sells its 5
    expect(await stock()).toEqual([["M", false], ["L", true]]);
  });

  test("a switched-off size's pieces are not handed to active sizes (D58b)", async () => {
    const { ids, move, stock, store } = await sizes(["M", "L"]);
    await move(10);
    await move(-10);
    await move(10, ids.L);
    await svc.from("product_variants").update({ is_active: false }).eq("id", ids.L);
    expect(await stock()).toEqual([["M", false]]);
    expect((await loadPublicProductPage(svc, store.slug, "abaya"))!.variants.map((v) => v.label)).toEqual(["M"]);
  });

  test("unpublished page 404", async () => {
    const { store } = await setup({ page: { status: "draft" } });
    expect(await loadPublicProductPage(svc, store.slug, "abaya")).toBeNull();
  });
  test("unpublish next request 404", async () => {
    const { store, page } = await setup();
    expect(await loadPublicProductPage(svc, store.slug, "abaya")).not.toBeNull();
    await svc.from("store_pages").update({ status: "draft" }).eq("id", page.id);
    expect(await loadPublicProductPage(svc, store.slug, "abaya")).toBeNull();
  });
  test("draft store 404", async () => {
    const { store } = await setup({ store: { status: "draft" } });
    expect(await loadPublicProductPage(svc, store.slug, "abaya")).toBeNull();
  });
  test("inactive product 404 and no price 404", async () => {
    const a = await setup({ product: { is_active: false } });
    expect(await loadPublicProductPage(svc, a.store.slug, "abaya")).toBeNull();
    const b = await setup({ product: { sale_price: null } });
    expect(await loadPublicProductPage(svc, b.store.slug, "abaya")).toBeNull();
  });
  test("price/name/is_active change shows", async () => {
    const { store, product } = await setup();
    await svc.from("products").update({ sale_price: 6000, name: "New" }).eq("id", product.id);
    const dto = await loadPublicProductPage(svc, store.slug, "abaya");
    expect(dto!.product).toMatchObject({ price: 6000, name: "New" });
    await svc.from("products").update({ is_active: false }).eq("id", product.id);
    expect(await loadPublicProductPage(svc, store.slug, "abaya")).toBeNull();
  });
  test("slug rename old url 404", async () => {
    const { store, page } = await setup();
    await svc.from("store_pages").update({ slug: "renamed" }).eq("id", page.id);
    expect(await loadPublicProductPage(svc, store.slug, "abaya")).toBeNull();
    expect(await loadPublicProductPage(svc, store.slug, "renamed")).not.toBeNull();
  });
  test("page of store A under store B slug 404", async () => {
    const a = await setup();
    const b = await setup();
    expect(await loadPublicProductPage(svc, b.store.slug, "abaya")).not.toBeNull();
    await svc.from("store_pages").update({ slug: "only-a" }).eq("id", a.page.id);
    expect(await loadPublicProductPage(svc, b.store.slug, "only-a")).toBeNull();
  });
  test("related id from other store dropped", async () => {
    const a = await setup();
    const b = await setup();
    const own = await setup({ store: { slug: tag() } });
    // second page in store a, and one in store b referenced from a
    const p2 = (await svc.from("products").insert({ workspace_id: ws, name: "Two", sale_price: 100 }).select("id").single()).data!.id;
    const pg2 = (await svc.from("store_pages").insert({ workspace_id: ws, store_id: a.store.id, product_id: p2, slug: "two", title: "Two", status: "published" }).select("id").single()).data!.id;
    await svc.from("store_pages").update({ blocks: [{ type: "related", pageIds: [pg2, b.page.id, own.page.id] }] }).eq("id", a.page.id);
    const dto = await loadPublicProductPage(svc, a.store.slug, "abaya");
    expect(dto!.related.map((r) => r.slug)).toEqual(["two"]);
  });
  test("related cards use the page price rule and drop unsellable products", async () => {
    const a = await setup();
    const mk = async (slug: string, mode: string, override: number | null) => {
      const pid = (await svc.from("products").insert({ workspace_id: ws, name: slug, sale_price: 5000, pricing_mode: mode }).select("id").single()).data!.id;
      const pgid = (await svc.from("store_pages").insert({ workspace_id: ws, store_id: a.store.id, product_id: pid, slug, title: slug, status: "published" }).select("id").single()).data!.id;
      const opt = (await svc.from("product_options").insert({ workspace_id: ws, product_id: pid, name: "Size", position: 0 }).select("id").single()).data!.id;
      const val = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: pid, option_id: opt, label: "S", position: 0 }).select("id").single()).data!.id;
      const v = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: pid, price_override: override }).select("id").single()).data!.id;
      await svc.from("product_variant_values").insert({ workspace_id: ws, product_id: pid, variant_id: v, option_id: opt, value_id: val });
      return pgid;
    };
    const dear = await mk("dear", "per_variant", 7000);
    const free = await mk("free", "per_variant", 0);
    await svc.from("store_pages").update({ blocks: [{ type: "related", pageIds: [dear, free] }] }).eq("id", a.page.id);
    const dto = await loadPublicProductPage(svc, a.store.slug, "abaya");
    expect(dto!.related.map((r) => [r.slug, r.price])).toEqual([["dear", 7000]]);
  });
  test("bad slug 404 no query", async () => {
    const from = vi.fn();
    const fake = { from } as unknown as SupabaseClient<Database>;
    for (const [s, p] of [["App", "x"], ["app", "x"], ["a_b", "x"], ["ok-store", "Bad"], ["ok-store", "../x"], ["", ""]]) {
      expect(await loadPublicProductPage(fake, s, p)).toBeNull();
    }
    expect(from).not.toHaveBeenCalled();
  });

  test("offers: inactive and expired are out, window respected, no free_delivery; capped saving; hidden when nothing saved", async () => {
    const { store, product } = await setup();
    const mk = (extra: Record<string, unknown>) =>
      svc.from("product_offers").insert({ workspace_id: ws, product_id: product.id, kind: "quantity", label: "x2", qty: 2, total_price: 9000, ...extra }).select("id").single();
    const live = (await mk({ position: 0 })).data!.id;
    await mk({ qty: 3, total_price: 12000, is_active: false });
    await mk({ qty: 4, total_price: 15000, active_to: "2020-01-01T00:00:00Z", active_from: "2019-01-01T00:00:00Z" });
    await mk({ qty: 5, total_price: 16000, active_from: "2999-01-01T00:00:00Z" });
    await mk({ qty: 6, total_price: 40000 }); // dearer than 6 x 5000 -> saves nothing -> hidden
    const dto = await loadPublicProductPage(svc, store.slug, "abaya");
    expect(dto!.offers).toEqual([{ id: live, label: "x2", qty: 2, total: 9000, saving: 1000 }]);
    expect(Object.keys(dto!.offers[0]).sort()).toEqual(["id", "label", "qty", "saving", "total"]);
    expect(JSON.stringify(dto)).not.toMatch(/free_delivery|"sku"|cost/);
  });

  test("bump: valid one shows, sized or inactive bump product is excluded", async () => {
    const { store, product } = await setup();
    const other = (await svc.from("products").insert({ workspace_id: ws, name: "Scarf \u2728", sale_price: 900 }).select("id").single()).data!.id;
    const b = (await svc.from("product_offers").insert({ workspace_id: ws, product_id: product.id, kind: "bump", label: "bump", bump_product_id: other, bump_price: 700 }).select("id").single()).data!.id;
    expect((await loadPublicProductPage(svc, store.slug, "abaya"))!.bump).toEqual({ id: b, name: "Scarf", price: 700 });
    await svc.from("products").update({ is_active: false }).eq("id", other);
    expect((await loadPublicProductPage(svc, store.slug, "abaya"))!.bump).toBeNull();
    await svc.from("products").update({ is_active: true }).eq("id", other);
    await svc.from("product_variants").insert({ workspace_id: ws, product_id: other });
    expect((await loadPublicProductPage(svc, store.slug, "abaya"))!.bump).toBeNull();
  });

  test("form: invalid fields jsonb renders defaults; enabled fields only", async () => {
    const { store, product } = await setup();
    let dto = await loadPublicProductPage(svc, store.slug, "abaya");
    expect(dto!.form.fields.map((f) => f.key)).toEqual(["name", "phone", "wilaya", "commune", "delivery", "note"]);
    await svc.from("product_forms").insert({ workspace_id: ws, product_id: product.id, fields: [{ type: "bogus" }], delivery_methods: ["home"] });
    dto = await loadPublicProductPage(svc, store.slug, "abaya");
    expect(dto!.form.fields).toHaveLength(6);
    expect(dto!.form.deliveryMethods).toEqual(["home"]);
  });

  test("per_value / per_variant prices, unsellable size excluded, lowest price on product", async () => {
    const { store, product } = await setup({ product: { compare_at_price: 4000 } });
    const o = (await svc.from("product_options").insert({ workspace_id: ws, product_id: product.id, name: "Size" }).select("id").single()).data!.id;
    const ids: Record<string, string> = {};
    for (const [label, delta] of [["S", -200], ["M", 0], ["L", 300], ["XL", -5000]] as const) {
      const v = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: product.id, option_id: o, label, price_delta: delta }).select("id").single()).data!.id;
      const x = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: product.id, price_override: label === "L" ? 7000 : null }).select("id").single()).data!.id;
      await svc.from("product_variant_values").insert({ variant_id: x, option_id: o, value_id: v, product_id: product.id, workspace_id: ws });
      ids[label] = x;
    }
    const prices = async () => (await loadPublicProductPage(svc, store.slug, "abaya"))!;
    let dto = await prices();
    expect(dto.variants.map((v) => [v.label, v.price]).sort()).toEqual([["L", 5000], ["M", 5000], ["S", 5000], ["XL", 5000]]);
    expect(dto.product.compareAt).toBeNull(); // compare 4000 is below the price
    await svc.from("products").update({ pricing_mode: "per_value" }).eq("id", product.id);
    dto = await prices();
    expect(dto.variants.map((v) => [v.label, v.price]).sort()).toEqual([["L", 5300], ["M", 5000], ["S", 4800]]); // XL refused
    expect(dto.product).toMatchObject({ price: 4800, priceFrom: true, pricingMode: "per_value" });
    await svc.from("products").update({ pricing_mode: "per_variant" }).eq("id", product.id);
    dto = await prices();
    expect(dto.variants.find((v) => v.label === "L")!.price).toBe(7000);
    expect(dto.variants.find((v) => v.label === "S")!.price).toBe(5000);
  });

  test("sized product shows the crossed-out price of its cheapest size", async () => {
    const { store, product } = await setup({ product: { compare_at_price: 6000 } });
    const o = (await svc.from("product_options").insert({ workspace_id: ws, product_id: product.id, name: "Size" }).select("id").single()).data!.id;
    for (const label of ["S", "M"]) {
      const v = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: product.id, option_id: o, label }).select("id").single()).data!.id;
      const x = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: product.id }).select("id").single()).data!.id;
      await svc.from("product_variant_values").insert({ variant_id: x, option_id: o, value_id: v, product_id: product.id, workspace_id: ws });
    }
    const dto = (await loadPublicProductPage(svc, store.slug, "abaya"))!;
    expect(dto.product).toMatchObject({ price: 5000, compareAt: 6000 });
  });

  test("every size unsellable -> 404", async () => {
    const { store, product } = await setup();
    await svc.from("products").update({ pricing_mode: "per_value" }).eq("id", product.id);
    const o = (await svc.from("product_options").insert({ workspace_id: ws, product_id: product.id, name: "Size" }).select("id").single()).data!.id;
    const v = (await svc.from("product_option_values").insert({ workspace_id: ws, product_id: product.id, option_id: o, label: "XL", price_delta: -5000 }).select("id").single()).data!.id;
    const x = (await svc.from("product_variants").insert({ workspace_id: ws, product_id: product.id }).select("id").single()).data!.id;
    await svc.from("product_variant_values").insert({ variant_id: x, option_id: o, value_id: v, product_id: product.id, workspace_id: ws });
    expect(await loadPublicProductPage(svc, store.slug, "abaya")).toBeNull();
  });
});
