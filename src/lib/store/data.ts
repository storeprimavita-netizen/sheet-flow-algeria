import "server-only";

import { unstable_cache } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

import { blocksSchema, seoSchema, type Block, type Seo } from "./blocks";
import { parseDeliveryMethods, parseFormFields, type FormField } from "./form-fields";
import { comparePrice, lowestPrice, offerSaving, unitPrice, visibleOffers, type PricingMode } from "./offer-price";
import { instagramLink, publicSettingsSchema, waLink } from "./settings";
import { isHttps, slugSchema, storeSlugSchema, stripEmoji } from "./url";
import { sizeInStock } from "./variant-stock";

export type PublicVariant = { id: string; label: string; inStock: boolean; price: number; compareAt: number | null };
export type PublicOffer = { id: string; label: string; qty: number; total: number; saving: number };
export type PublicBump = { id: string; name: string; price: number };
export type PublicForm = { fields: FormField[]; deliveryMethods: ("home" | "stopdesk")[] };
export type PublicRelated = { slug: string; title: string; image: string | null; price: number };
export type PublicProductPage = {
  store: {
    slug: string;
    name: string;
    theme: string;
    settings: { phone?: string; whatsappUrl?: string; instagramUrl?: string; announcement?: string; slogan?: string };
  };
  page: { slug: string; title: string; blocks: Block[]; seo: Seo };
  product: { name: string; price: number | null; compareAt: number | null; pricingMode: PricingMode; priceFrom: boolean; images: string[] };
  variants: PublicVariant[];
  offers: PublicOffer[];
  bump: PublicBump | null;
  form: PublicForm;
  related: PublicRelated[];
};

type Db = SupabaseClient<Database>;

export const PUBLIC_REVALIDATE_S = 120;

export const storeTags = (store: string, page: string) => ["store-public", `store:${store}`, `page:${store}/${page}`];

/**
 * The public store reads through the service role and returns a cost-free DTO.
 * Returns null for anything not public. Pure over `db`, so tests drive it directly.
 */
export async function loadPublicProductPage(db: Db, storeSlug: string, pageSlug: string): Promise<PublicProductPage | null> {
  const s = storeSlugSchema.safeParse(storeSlug);
  const p = slugSchema.safeParse(pageSlug);
  if (!s.success || !p.success) return null;

  const { data: store, error: storeErr } = await db
    .from("stores")
    .select("id, workspace_id, slug, name, status, theme, settings")
    .eq("slug", s.data)
    .eq("status", "live")
    .maybeSingle();
  if (storeErr) throw new Error(`store lookup failed: ${storeErr.message}`);
  if (!store) return null;

  const { data: page, error: pageErr } = await db
    .from("store_pages")
    .select("id, workspace_id, store_id, product_id, slug, title, blocks, seo")
    .eq("store_id", store.id)
    .eq("slug", p.data)
    .eq("status", "published")
    .eq("kind", "product")
    .maybeSingle();
  if (pageErr) throw new Error(`page lookup failed: ${pageErr.message}`);
  if (!page || !page.product_id || page.workspace_id !== store.workspace_id) return null;

  const { data: product, error: productErr } = await db
    .from("products")
    .select("id, workspace_id, name, sale_price, compare_at_price, pricing_mode, images, is_active, stock")
    .eq("id", page.product_id)
    .eq("is_active", true)
    .not("sale_price", "is", null)
    .maybeSingle();
  if (productErr) throw new Error(`product lookup failed: ${productErr.message}`);
  if (!product || product.workspace_id !== store.workspace_id || product.sale_price === null) return null;

  return assembleProductPage(db, store, page, product);
}

type StoreRow = Pick<Database["public"]["Tables"]["stores"]["Row"], "id" | "workspace_id" | "slug" | "name" | "theme" | "settings">;
type PageRow = Pick<Database["public"]["Tables"]["store_pages"]["Row"], "slug" | "title" | "blocks" | "seo">;
type ProductRow = Pick<Database["public"]["Tables"]["products"]["Row"], "id" | "name" | "sale_price" | "compare_at_price" | "pricing_mode" | "images" | "stock">;

/** Shared by the public page and the admin preview: the same DTO either way, so a preview shows what a visitor will see. */
export async function assembleProductPage(
  db: Db,
  store: StoreRow,
  page: PageRow & { id?: string },
  product: ProductRow,
  now: Date = new Date(),
): Promise<PublicProductPage> {
  const blocks = blocksSchema.safeParse(page.blocks);
  const seo = seoSchema.safeParse(page.seo);
  const settings = publicSettingsSchema.safeParse(store.settings);
  const set = settings.success ? settings.data : {};

  const mode: PricingMode = product.pricing_mode === "per_value" || product.pricing_mode === "per_variant" ? product.pricing_mode : "uniform";
  const base = product.sale_price === null ? null : Number(product.sale_price);
  const compareBase = product.compare_at_price === null ? null : Number(product.compare_at_price);

  const [variants, related, offerRows, form] = await Promise.all([
    loadVariants(db, product, mode, base, compareBase),
    loadRelated(db, store.id, store.workspace_id, blocks.success ? blocks.data : [], page.id),
    loadOffers(db, product.id, store.workspace_id, now),
    loadForm(db, product.id),
  ]);

  // The price shown on the page: the lowest sellable size, or the plain price when the product has no sizes.
  const hasSizes = variants.sizes > 0;
  const unit = hasSizes ? lowestPrice(variants.list.map((v) => v.price)) : base !== null ? unitPrice({ mode: "uniform", basePrice: base, compareAt: null, valueDeltas: [], override: null, compareOverride: null }) : null;
  const priceFrom = hasSizes && new Set(variants.list.map((v) => v.price)).size > 1;
  const compareAt = !hasSizes && unit !== null && compareBase !== null ? comparePrice({ mode: "uniform", basePrice: base ?? 0, compareAt: compareBase, valueDeltas: [], override: null, compareOverride: null }, unit) : null;
  // an offer is shown when it saves something at the cheapest size (the saving is the smallest one)
  const offers: PublicOffer[] =
    unit === null
      ? []
      : visibleOffers(unit, offerRows).map((o) => ({ id: o.id, label: o.label, qty: o.qty, total: o.total, saving: offerSaving(unit, o) }));

  return {
    store: {
      slug: store.slug,
      name: store.name,
      theme: store.theme,
      settings: {
        phone: set.phone,
        whatsappUrl: set.whatsapp ? waLink(set.whatsapp) : undefined,
        instagramUrl: set.instagram ? instagramLink(set.instagram) : undefined,
        announcement: set.announcement,
        slogan: set.slogan,
      },
    },
    page: { slug: page.slug, title: page.title, blocks: blocks.success ? blocks.data : [], seo: seo.success ? seo.data : {} },
    product: {
      name: stripEmoji(product.name) || page.title,
      price: unit,
      compareAt,
      pricingMode: mode,
      priceFrom,
      images: (product.images ?? []).filter(isHttps),
    },
    variants: variants.list,
    offers,
    bump: offerRows.bump,
    form,
    related,
  };
}

/** D54.4: stock rule lives in variant-stock.ts. A size whose price is <= 0 is refused (not offered). */
async function loadVariants(
  db: Db,
  product: ProductRow,
  mode: PricingMode,
  base: number | null,
  compareBase: number | null,
): Promise<{ list: PublicVariant[]; sizes: number }> {
  const productId = product.id;
  const [opts, vals, vars, joins] = await Promise.all([
    db.from("product_options").select("id, position").eq("product_id", productId),
    db.from("product_option_values").select("id, label, price_delta").eq("product_id", productId),
    db.from("product_variants").select("id, stock, is_active, price_override, compare_at_override").eq("product_id", productId),
    db.from("product_variant_values").select("variant_id, option_id, value_id").eq("product_id", productId),
  ]);
  const failed = [opts, vals, vars, joins].find((r) => r.error);
  if (failed?.error) throw new Error(`variants lookup failed: ${failed.error.message}`);
  const pos = new Map((opts.data ?? []).map((o) => [o.id, o.position]));
  const value = new Map((vals.data ?? []).map((v) => [v.id, v]));
  const total = (vars.data ?? []).reduce((n, v) => n + v.stock, 0);
  const active = (vars.data ?? []).filter((v) => v.is_active);
  const list = active.flatMap((v) => {
    const mine = (joins.data ?? [])
      .filter((j) => j.variant_id === v.id)
      .sort((a, b) => (pos.get(a.option_id) ?? 0) - (pos.get(b.option_id) ?? 0))
      .flatMap((j) => (value.has(j.value_id) ? [value.get(j.value_id)!] : []));
    if (!mine.length || base === null) return [];
    const input = {
      mode,
      basePrice: base,
      compareAt: compareBase,
      valueDeltas: mine.map((m) => m.price_delta),
      override: v.price_override,
      compareOverride: v.compare_at_override,
    };
    const price = unitPrice(input);
    if (price === null) return [];
    return [{ id: v.id, label: mine.map((m) => m.label).join(" / "), inStock: sizeInStock(v.stock, product.stock, total), price, compareAt: comparePrice(input, price) }];
  });
  return { list, sizes: active.length };
}

type OfferRows = OfferInputRow[] & { bump: PublicBump | null };
type OfferInputRow = { id: string; label: string; qty: number; total: number };

/** Active offers inside their window (Africa/Algiers is UTC+1 all year, so a UTC compare is exact) and one valid bump. */
async function loadOffers(db: Db, productId: string, workspaceId: string, now: Date = new Date()): Promise<OfferRows> {
  const { data, error } = await db
    .from("product_offers")
    .select("id, kind, label, qty, total_price, bump_product_id, bump_price, is_default, position, active_from, active_to")
    .eq("product_id", productId)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("position", { ascending: true });
  if (error) throw new Error(`offers lookup failed: ${error.message}`);
  const t = now.getTime();
  const live = (data ?? []).filter(
    (o) => (!o.active_from || new Date(o.active_from).getTime() <= t) && (!o.active_to || new Date(o.active_to).getTime() > t),
  );
  const rows: OfferInputRow[] = live.flatMap((o) =>
    o.kind === "quantity" && o.qty !== null && o.total_price !== null ? [{ id: o.id, label: stripEmoji(o.label), qty: o.qty, total: o.total_price }] : [],
  );

  let bump: PublicBump | null = null;
  const b = live.find((o) => o.kind === "bump" && o.bump_product_id && o.bump_price !== null);
  if (b?.bump_product_id) {
    const [{ data: bp, error: bpErr }, { count, error: cErr }] = await Promise.all([
      db
        .from("products")
        .select("name, sale_price, is_active, workspace_id")
        .eq("id", b.bump_product_id)
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .not("sale_price", "is", null)
        .maybeSingle(),
      db.from("product_variants").select("id", { count: "exact", head: true }).eq("product_id", b.bump_product_id),
    ]);
    if (bpErr || cErr) throw new Error(`bump lookup failed: ${(bpErr ?? cErr)!.message}`);
    if (bp && !count && b.bump_price !== null && b.bump_price > 0) bump = { id: b.id, name: stripEmoji(bp.name), price: b.bump_price };
  }
  return Object.assign(rows, { bump });
}

async function loadForm(db: Db, productId: string): Promise<PublicForm> {
  const { data, error } = await db.from("product_forms").select("fields, delivery_methods").eq("product_id", productId).maybeSingle();
  if (error) throw new Error(`form lookup failed: ${error.message}`);
  return {
    fields: parseFormFields(data?.fields ?? null).filter((f) => f.enabled),
    deliveryMethods: parseDeliveryMethods(data?.delivery_methods ?? null),
  };
}

async function loadRelated(db: Db, storeId: string, workspaceId: string, blocks: Block[], selfId?: string): Promise<PublicRelated[]> {
  const ids = blocks.flatMap((b) => (b.type === "related" ? b.pageIds : [])).filter((id) => id !== selfId).slice(0, 6);
  if (!ids.length) return [];
  const { data: pages, error: pagesErr } = await db
    .from("store_pages")
    .select("id, slug, title, product_id")
    .in("id", ids)
    .eq("store_id", storeId)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .eq("kind", "product");
  if (pagesErr) throw new Error(`related lookup failed: ${pagesErr.message}`);
  const productIds = (pages ?? []).flatMap((p) => (p.product_id ? [p.product_id] : []));
  if (!productIds.length) return [];
  const { data: products, error: productsErr } = await db
    .from("products")
    .select("id, name, sale_price, images")
    .in("id", productIds)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .not("sale_price", "is", null);
  if (productsErr) throw new Error(`related products lookup failed: ${productsErr.message}`);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const order = new Map(ids.map((id, i) => [id, i]));
  const ordered = [...(pages ?? [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return ordered.flatMap((pg) => {
    const pr = pg.product_id ? byId.get(pg.product_id) : undefined;
    if (!pr || pr.sale_price === null) return [];
    return [{ slug: pg.slug, title: stripEmoji(pr.name) || pg.title, image: (pr.images ?? []).find(isHttps) ?? null, price: Number(pr.sale_price) }];
  });
}

/** Live store slugs, cached once: random /s/<unknown>/<x> URLs 404 here without a per-URL cache entry or query. */
const liveStoreSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const { data, error } = await (await createAdminClient()).from("stores").select("slug").eq("status", "live");
    if (error) throw new Error(`live stores lookup failed: ${error.message}`);
    return (data ?? []).map((r) => r.slug.toLowerCase());
  },
  ["store-live-slugs"],
  { tags: ["store-public"], revalidate: PUBLIC_REVALIDATE_S },
);

/** Cached for 120 s (covers trigger-driven stock); every mutation also calls updateTag('store-public'). */
export async function getPublicProductPage(storeSlug: string, pageSlug: string): Promise<PublicProductPage | null> {
  // bad slugs never reach the cache or the database
  if (!storeSlugSchema.safeParse(storeSlug).success || !slugSchema.safeParse(pageSlug).success) return null;
  if (!(await liveStoreSlugs()).includes(storeSlug.toLowerCase())) return null;
  const run = unstable_cache(
    async () => loadPublicProductPage(await createAdminClient(), storeSlug, pageSlug),
    ["store-page", storeSlug, pageSlug],
    { tags: storeTags(storeSlug, pageSlug), revalidate: PUBLIC_REVALIDATE_S },
  );
  return run();
}
