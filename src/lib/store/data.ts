import "server-only";

import { unstable_cache } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

import { blocksSchema, seoSchema, type Block, type Seo } from "./blocks";
import { parseDeliveryMethods, parseFormFields, type FormField } from "./form-fields";
import { comparePrice, lowestPrice, offerSaving, unitPrice, visibleOffers, type PricingMode } from "./offer-price";
import { isVerifiedOrder, publicReviewName } from "./reviews";
import { instagramLink, publicSettingsSchema, waLink } from "./settings";
import { isHttps, slugSchema, storeSlugSchema, stripEmoji } from "./url";
import { sizeInStock } from "./variant-stock";

export type PublicSwatch = { color: string | null; image: string | null };
export type PublicOptionValue = { label: string; swatch: PublicSwatch | null; inStock: boolean };
/** One chip row per option (Size, Color...). A value is in stock when any active size with it has stock. */
export type PublicOption = { name: string; kind: "text" | "color"; values: PublicOptionValue[] };
export type PublicVariant = {
  id: string;
  label: string;
  inStock: boolean;
  price: number;
  compareAt: number | null;
  color?: { key: number; label: string; swatch: PublicSwatch | null; remainingLabel: string | null };
};
export type PublicOffer = { id: string; label: string; qty: number; total: number; saving: number };
export type PublicBump = { id: string; name: string; price: number };
export type PublicForm = { fields: FormField[]; deliveryMethods: ("home" | "stopdesk")[] };
export type PublicRelated = { slug: string; title: string; image: string | null; price: number };
/** No ids: nothing here can be traced back to a customer, an order or a workspace. `name` is "" when nothing is left to show. */
export type PublicReview = { name: string; rating: number; text: string; date: string; verified: boolean };
export type PublicReviews = { avg: number; count: number; items: PublicReview[] };
export const MAX_PUBLIC_REVIEWS = 60;
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
  /** option chip rows with swatches (VAR-1) for the product page when no order form is shown */
  options: PublicOption[];
  offers: PublicOffer[];
  bump: PublicBump | null;
  form: PublicForm;
  related: PublicRelated[];
  reviews: PublicReviews;
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

  const built = await buildProductPage(db, store, page, product);
  return built.sellable ? built.dto : null;
}

type StoreRow = Pick<Database["public"]["Tables"]["stores"]["Row"], "id" | "workspace_id" | "slug" | "name" | "theme" | "settings">;
type PageRow = Pick<Database["public"]["Tables"]["store_pages"]["Row"], "slug" | "title" | "blocks" | "seo">;
type ProductRow = Pick<Database["public"]["Tables"]["products"]["Row"], "id" | "name" | "sale_price" | "compare_at_price" | "pricing_mode" | "images" | "stock">;

/** Shared by the public page and the admin preview: the same DTO either way, so a preview shows what a visitor will see. */
export async function assembleProductPage(db: Db, store: StoreRow, page: PageRow & { id?: string }, product: ProductRow, now: Date = new Date()): Promise<PublicProductPage> {
  return (await buildProductPage(db, store, page, product, now)).dto;
}

/** `sellable` is false when nothing can be bought (no price, price <= 0, or no size can be sold): visitors get a 404, the admin preview still renders. */
async function buildProductPage(
  db: Db,
  store: StoreRow,
  page: PageRow & { id?: string },
  product: ProductRow,
  now: Date = new Date(),
): Promise<{ dto: PublicProductPage; sellable: boolean }> {
  const blocks = blocksSchema.safeParse(page.blocks);
  const seo = seoSchema.safeParse(page.seo);
  const settings = publicSettingsSchema.safeParse(store.settings);
  const set = settings.success ? settings.data : {};

  const mode: PricingMode = product.pricing_mode === "per_value" || product.pricing_mode === "per_variant" ? product.pricing_mode : "uniform";
  const base = product.sale_price === null ? null : Number(product.sale_price);
  const compareBase = product.compare_at_price === null ? null : Number(product.compare_at_price);

  const list = blocks.success ? blocks.data : [];
  const [variants, related, offerRows, form, reviews] = await Promise.all([
    loadVariants(db, product, mode, base, compareBase),
    loadRelated(db, store.id, store.workspace_id, list, page.id),
    loadOffers(db, product.id, store.workspace_id, now),
    loadForm(db, product.id),
    list.some((b) => b.type === "reviews") ? loadReviews(db, store.workspace_id, product.id) : Promise.resolve({ avg: 0, count: 0, items: [] }),
  ]);

  // The price shown on the page: the lowest sellable size, or the plain price when the product has no sizes.
  const hasSizes = variants.sizes > 0;
  const unit = hasSizes ? lowestPrice(variants.list.map((v) => v.price)) : base !== null ? unitPrice({ mode: "uniform", basePrice: base, compareAt: null, valueDeltas: [], override: null, compareOverride: null }) : null;
  const priceFrom = hasSizes && new Set(variants.list.map((v) => v.price)).size > 1;
  const cheapest = hasSizes ? variants.list.find((v) => v.price === unit) : undefined;
  const compareAt = hasSizes ? (cheapest?.compareAt ?? null) : unit !== null && compareBase !== null ? comparePrice({ mode: "uniform", basePrice: base ?? 0, compareAt: compareBase, valueDeltas: [], override: null, compareOverride: null }, unit) : null;
  // an offer is shown when it saves something at the cheapest size (the saving is the smallest one)
  const offers: PublicOffer[] =
    unit === null
      ? []
      : visibleOffers(unit, offerRows).map((o) => ({ id: o.id, label: o.label, qty: o.qty, total: o.total, saving: offerSaving(unit, o) }));

  const dto: PublicProductPage = {
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
    options: variants.options,
    offers,
    bump: offerRows.bump,
    form,
    related,
    reviews,
  };
  return { dto, sellable: unit !== null };
}

/** Approved reviews only. Summary comes from every approved rating (plain fetch, no aggregate); the list is the latest 60. */
export async function loadReviews(db: Db, workspaceId: string, productId: string): Promise<PublicReviews> {
  const base = () => db.from("reviews").select("rating", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("product_id", productId).eq("approved", true);
  const [total, latest] = await Promise.all([
    base(),
    db
      .from("reviews")
      .select("name, rating, body, order_id, created_at")
      .eq("workspace_id", workspaceId)
      .eq("product_id", productId)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(MAX_PUBLIC_REVIEWS),
  ]);
  if (total.error) throw new Error(`reviews summary failed: ${total.error.message}`);
  if (latest.error) throw new Error(`reviews lookup failed: ${latest.error.message}`);
  const rows = total.count ?? 0;
  // PostgREST caps a response at max_rows (1000): page through the ratings so the average stays exact.
  let sum = 0;
  let count = 0;
  for (let from = 0; from < rows; from += 1000) {
    const { data, error } = await db
      .from("reviews")
      .select("rating, body")
      .eq("workspace_id", workspaceId)
      .eq("product_id", productId)
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(`reviews summary failed: ${error.message}`);
    // Only reviews that render count, so the summary always matches the cards (emoji-only bodies are dropped).
    for (const r of data ?? []) {
      if (!stripEmoji(r.body)) continue;
      sum += r.rating;
      count += 1;
    }
  }
  const avg = count ? sum / count : 0;

  const orderIds = [...new Set((latest.data ?? []).flatMap((r) => (r.order_id ? [r.order_id] : [])))];
  const orders = new Map<string, { product_id: string | null; confirmation_status: string; excluded_reason: string | null }>();
  if (orderIds.length) {
    const { data, error } = await db
      .from("orders")
      .select("id, product_id, confirmation_status, excluded_reason")
      .in("id", orderIds)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(`reviews orders lookup failed: ${error.message}`);
    for (const o of data ?? []) orders.set(o.id, o);
  }
  return {
    avg: Math.round(avg * 10) / 10,
    count,
    items: (latest.data ?? []).flatMap((r) => {
      const text = stripEmoji(r.body);
      if (!text) return [];
      return [
        {
          name: publicReviewName(r.name),
          rating: r.rating,
          text,
          date: r.created_at,
          verified: isVerifiedOrder(r.order_id ? orders.get(r.order_id) : null, productId),
        },
      ];
    }),
  };
}

/** D54.4: stock rule lives in variant-stock.ts. A size whose price is <= 0 is refused (not offered). */
async function loadVariants(
  db: Db,
  product: ProductRow,
  mode: PricingMode,
  base: number | null,
  compareBase: number | null,
): Promise<{ list: PublicVariant[]; options: PublicOption[]; sizes: number }> {
  const productId = product.id;
  const [opts, vals, vars, joins] = await Promise.all([
    db.from("product_options").select("id, name, kind, position").eq("product_id", productId).order("position"),
    db.from("product_option_values").select("id, option_id, label, position, price_delta, swatch_color, swatch_image").eq("product_id", productId).order("position"),
    db.from("product_variants").select("id, stock, is_active, price_override, compare_at_override").eq("product_id", productId),
    db.from("product_variant_values").select("variant_id, option_id, value_id").eq("product_id", productId),
  ]);
  const failed = [opts, vals, vars, joins].find((r) => r.error);
  if (failed?.error) throw new Error(`variants lookup failed: ${failed.error.message}`);
  const pos = new Map((opts.data ?? []).map((o) => [o.id, o.position]));
  const value = new Map((vals.data ?? []).map((v) => [v.id, v]));
  const colorOption = opts.data?.find((o) => o.kind === "color");
  const colorKeys = new Map((vals.data ?? []).filter((v) => v.option_id === colorOption?.id).map((v, index) => [v.id, index]));
  const total = (vars.data ?? []).reduce((n, v) => n + v.stock, 0);
  const active = (vars.data ?? []).filter((v) => v.is_active);
  const list = active.flatMap((v): PublicVariant[] => {
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
    const variant = {
      id: v.id,
      label: mine.map((m) => m.label).join(" / "),
      inStock: sizeInStock(v.stock, product.stock, total),
      price,
      compareAt: comparePrice(input, price),
    };
    const colorValue = mine.find((m) => m.option_id === colorOption?.id);
    const colorKey = colorValue && colorKeys.get(colorValue.id);
    if (!colorValue || colorKey === undefined) return [variant];
    return [{
      ...variant,
      color: {
        key: colorKey,
        label: colorValue.label,
        swatch: publicSwatch(colorValue),
        remainingLabel: mine.filter((m) => m !== colorValue).map((m) => m.label).join(" / ") || null,
      },
    }];
  });
  // chip rows for the product page (VAR-1): a value is in stock when any active size that carries it is
  const stockOf = new Map<string, boolean>();
  for (const v of active) {
    const has = sizeInStock(v.stock, product.stock, total);
    for (const j of (joins.data ?? []).filter((x) => x.variant_id === v.id)) stockOf.set(j.value_id, (stockOf.get(j.value_id) ?? false) || has);
  }
  const options = (opts.data ?? []).flatMap((o) => {
    const values = (vals.data ?? [])
      .filter((v) => v.option_id === o.id && stockOf.has(v.id))
      .map((v): PublicOptionValue => ({
        label: v.label,
        swatch: o.kind === "color" ? publicSwatch(v) : null,
        inStock: stockOf.get(v.id) ?? false,
      }));
    return values.length ? [{ name: o.name, kind: o.kind === "color" ? ("color" as const) : ("text" as const), values }] : [];
  });
  return { list, options, sizes: active.length };
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

const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_SWATCH_URL = /^https:\/\/[^\s"'()<>\\]{1,2040}$/;

function publicSwatch({ swatch_color, swatch_image }: { swatch_color: string | null; swatch_image: string | null }): PublicSwatch | null {
  // A validated photo takes precedence and is rendered only as an image source.
  const image = swatch_image && isHttps(swatch_image) && SAFE_SWATCH_URL.test(swatch_image) ? swatch_image : null;
  const color = !image && swatch_color && HEX.test(swatch_color) ? swatch_color : null;
  return image || color ? { color, image } : null;
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
    .select("id, name, sale_price, compare_at_price, pricing_mode, images, stock")
    .in("id", productIds)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .not("sale_price", "is", null);
  if (productsErr) throw new Error(`related products lookup failed: ${productsErr.message}`);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  const order = new Map(ids.map((id, i) => [id, i]));
  const ordered = [...(pages ?? [])].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  // same price rule as the product page: lowest sellable size; products nobody can buy are dropped (their link would 404)
  const cards = await Promise.all(
    ordered.map(async (pg): Promise<PublicRelated | null> => {
      const pr = pg.product_id ? byId.get(pg.product_id) : undefined;
      if (!pr || pr.sale_price === null) return null;
      const mode: PricingMode = pr.pricing_mode === "per_value" || pr.pricing_mode === "per_variant" ? pr.pricing_mode : "uniform";
      const base = Number(pr.sale_price);
      const { list, sizes } = await loadVariants(db, pr, mode, base, pr.compare_at_price === null ? null : Number(pr.compare_at_price));
      const price =
        sizes > 0
          ? lowestPrice(list.map((v) => v.price))
          : unitPrice({ mode: "uniform", basePrice: base, compareAt: null, valueDeltas: [], override: null, compareOverride: null });
      if (price === null) return null;
      return { slug: pg.slug, title: stripEmoji(pr.name) || pg.title, image: (pr.images ?? []).find(isHttps) ?? null, price };
    }),
  );
  return cards.filter((c): c is PublicRelated => c !== null);
}

/** Live store slugs, cached once: random /s/<unknown>/<x> URLs 404 here without a per-URL cache entry or query. */
const liveStoreSlugs = unstable_cache(
  async (): Promise<string[]> => {
    const db = await createAdminClient();
    const slugs: string[] = [];
    // PostgREST caps a response at max_rows (1000): page through so no live store is missed.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from("stores").select("slug").eq("status", "live").order("id").range(from, from + 999);
      if (error) throw new Error(`live stores lookup failed: ${error.message}`);
      slugs.push(...(data ?? []).map((r) => r.slug.toLowerCase()));
      if ((data ?? []).length < 1000) return slugs;
    }
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
