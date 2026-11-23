import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import { comparePrice, lowestPrice, unitPrice, type PricingMode } from "./offer-price";
import { isHttps } from "./url";
import { sizeInStock } from "./variant-stock";

type Db = SupabaseClient<Database>;
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
type PriceProduct = Pick<Database["public"]["Tables"]["products"]["Row"], "id" | "sale_price" | "compare_at_price" | "pricing_mode" | "stock">;

export async function loadEffectivePrice(db: Db, product: PriceProduct) {
  const mode: PricingMode = product.pricing_mode === "per_value" || product.pricing_mode === "per_variant" ? product.pricing_mode : "uniform";
  const base = product.sale_price === null ? null : Number(product.sale_price);
  const compareBase = product.compare_at_price === null ? null : Number(product.compare_at_price);
  const variants = await loadVariants(db, product, mode, base, compareBase);
  const hasSizes = variants.sizes > 0;
  const uniformInput = base === null ? null : {
    mode: "uniform" as const, basePrice: base, compareAt: compareBase, valueDeltas: [], override: null, compareOverride: null,
  };
  const unit = hasSizes ? lowestPrice(variants.list.map((v) => v.price)) : uniformInput ? unitPrice(uniformInput) : null;
  return { mode, variants, hasSizes, unit, uniformInput };
}

/** Readiness at the time of the editor read or publish action. Availability does not affect pricing. */
export async function isProductPublishable(db: Db, workspaceId: string, productId: string): Promise<boolean> {
  const { data: product, error } = await db.from("products")
    .select("id, is_active, sale_price, pricing_mode, compare_at_price, stock")
    .eq("id", productId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw new Error(`isProductPublishable: ${error.message}`);
  if (!product?.is_active || product.sale_price === null) return false;
  return (await loadEffectivePrice(db, product)).unit !== null;
}

/** D54.4: stock rule lives in variant-stock.ts. A size whose price is <= 0 is refused (not offered). */
async function loadVariants(
  db: Db,
  product: Pick<PriceProduct, "id" | "stock">,
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

const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_SWATCH_URL = /^https:\/\/[^\s"'()<>\\]{1,2040}$/;

function publicSwatch({ swatch_color, swatch_image }: { swatch_color: string | null; swatch_image: string | null }): PublicSwatch | null {
  // A validated photo takes precedence and is rendered only as an image source.
  const image = swatch_image && isHttps(swatch_image) && SAFE_SWATCH_URL.test(swatch_image) ? swatch_image : null;
  const color = !image && swatch_color && HEX.test(swatch_color) ? swatch_color : null;
  return image || color ? { color, image } : null;
}

