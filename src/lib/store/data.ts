import "server-only";

import { unstable_cache } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

import { blocksSchema, seoSchema, type Block, type Seo } from "./blocks";
import { instagramLink, publicSettingsSchema, waLink } from "./settings";
import { isHttps, slugSchema, storeSlugSchema, stripEmoji } from "./url";

export type PublicVariant = { label: string; inStock: boolean };
export type PublicRelated = { slug: string; title: string; image: string | null; price: number };
export type PublicProductPage = {
  store: {
    slug: string;
    name: string;
    theme: string;
    settings: { phone?: string; whatsappUrl?: string; instagramUrl?: string; announcement?: string; slogan?: string };
  };
  page: { slug: string; title: string; blocks: Block[]; seo: Seo };
  product: { name: string; price: number; images: string[] };
  variants: PublicVariant[];
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

  const { data: store } = await db
    .from("stores")
    .select("id, workspace_id, slug, name, status, theme, settings")
    .eq("slug", s.data)
    .eq("status", "live")
    .maybeSingle();
  if (!store) return null;

  const { data: page } = await db
    .from("store_pages")
    .select("id, workspace_id, store_id, product_id, slug, title, blocks, seo")
    .eq("store_id", store.id)
    .eq("slug", p.data)
    .eq("status", "published")
    .eq("kind", "product")
    .maybeSingle();
  if (!page || !page.product_id || page.workspace_id !== store.workspace_id) return null;

  const { data: product } = await db
    .from("products")
    .select("id, workspace_id, name, sale_price, images, is_active")
    .eq("id", page.product_id)
    .eq("is_active", true)
    .not("sale_price", "is", null)
    .maybeSingle();
  if (!product || product.workspace_id !== store.workspace_id || product.sale_price === null) return null;

  const blocks = blocksSchema.safeParse(page.blocks);
  const seo = seoSchema.safeParse(page.seo);
  const settings = publicSettingsSchema.safeParse(store.settings);
  const set = settings.success ? settings.data : {};

  const [variants, related] = await Promise.all([
    loadVariants(db, product.id),
    loadRelated(db, store.id, store.workspace_id, blocks.success ? blocks.data : []),
  ]);

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
      price: Number(product.sale_price),
      images: (product.images ?? []).filter(isHttps),
    },
    variants,
    related,
  };
}

async function loadVariants(db: Db, productId: string): Promise<PublicVariant[]> {
  const [opts, vals, vars, joins] = await Promise.all([
    db.from("product_options").select("id, position").eq("product_id", productId),
    db.from("product_option_values").select("id, label").eq("product_id", productId),
    db.from("product_variants").select("id, stock").eq("product_id", productId).eq("is_active", true),
    db.from("product_variant_values").select("variant_id, option_id, value_id").eq("product_id", productId),
  ]);
  const pos = new Map((opts.data ?? []).map((o) => [o.id, o.position]));
  const label = new Map((vals.data ?? []).map((v) => [v.id, v.label]));
  return (vars.data ?? []).flatMap((v) => {
    const parts = (joins.data ?? [])
      .filter((j) => j.variant_id === v.id)
      .sort((a, b) => (pos.get(a.option_id) ?? 0) - (pos.get(b.option_id) ?? 0))
      .map((j) => label.get(j.value_id))
      .filter((l): l is string => !!l);
    return parts.length ? [{ label: parts.join(" / "), inStock: v.stock > 0 }] : [];
  });
}

async function loadRelated(db: Db, storeId: string, workspaceId: string, blocks: Block[]): Promise<PublicRelated[]> {
  const ids = blocks.flatMap((b) => (b.type === "related" ? b.pageIds : [])).slice(0, 6);
  if (!ids.length) return [];
  const { data: pages } = await db
    .from("store_pages")
    .select("id, slug, title, product_id")
    .in("id", ids)
    .eq("store_id", storeId)
    .eq("workspace_id", workspaceId)
    .eq("status", "published")
    .eq("kind", "product");
  const productIds = (pages ?? []).flatMap((p) => (p.product_id ? [p.product_id] : []));
  if (!productIds.length) return [];
  const { data: products } = await db
    .from("products")
    .select("id, name, sale_price, images")
    .in("id", productIds)
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .not("sale_price", "is", null);
  const byId = new Map((products ?? []).map((p) => [p.id, p]));
  return (pages ?? []).flatMap((pg) => {
    const pr = pg.product_id ? byId.get(pg.product_id) : undefined;
    if (!pr || pr.sale_price === null) return [];
    return [{ slug: pg.slug, title: stripEmoji(pr.name) || pg.title, image: (pr.images ?? []).find(isHttps) ?? null, price: Number(pr.sale_price) }];
  });
}

/** Cached for 120 s (covers trigger-driven stock); every mutation also calls updateTag('store-public'). */
export async function getPublicProductPage(storeSlug: string, pageSlug: string): Promise<PublicProductPage | null> {
  // bad slugs never reach the cache or the database
  if (!storeSlugSchema.safeParse(storeSlug).success || !slugSchema.safeParse(pageSlug).success) return null;
  const run = unstable_cache(
    async () => loadPublicProductPage(await createAdminClient(), storeSlug, pageSlug),
    ["store-page", storeSlug, pageSlug],
    { tags: storeTags(storeSlug, pageSlug), revalidate: PUBLIC_REVALIDATE_S },
  );
  return run();
}
