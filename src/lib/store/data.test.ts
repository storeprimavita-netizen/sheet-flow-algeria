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
    expect(Object.keys(dto!).sort()).toEqual(["page", "product", "related", "store", "variants"]);
    expect(Object.keys(dto!.store).sort()).toEqual(["name", "settings", "slug", "theme"]);
    expect(Object.keys(dto!.page).sort()).toEqual(["blocks", "seo", "slug", "title"]);
    expect(Object.keys(dto!.product).sort()).toEqual(["images", "name", "price"]);
    expect(dto!.variants).toEqual([{ label: "M", inStock: false }]);
    expect(Object.keys(dto!.variants[0]).sort()).toEqual(["inStock", "label"]);
    expect(dto!.product.name).toBe("عباية");
    expect(dto!.product.images).toEqual(["https://x.com/a.jpg"]); // DAL drops non-https image
    expect(JSON.stringify(dto)).not.toMatch(/SECRET|workspace_id|cost|"id"/);
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
  test("bad slug 404 no query", async () => {
    const from = vi.fn();
    const fake = { from } as unknown as SupabaseClient<Database>;
    for (const [s, p] of [["App", "x"], ["app", "x"], ["a_b", "x"], ["ok-store", "Bad"], ["ok-store", "../x"], ["", ""]]) {
      expect(await loadPublicProductPage(fake, s, p)).toBeNull();
    }
    expect(from).not.toHaveBeenCalled();
  });
});
