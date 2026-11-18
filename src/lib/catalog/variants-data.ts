import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { variantLabel, type VariantOption } from "@/lib/variants";

type Db = Awaited<ReturnType<typeof createClient>>;

export type VariantDTO = {
  id: string;
  productId: string;
  sku: string | null;
  isActive: boolean;
  stock: number;
  label: string;
  /** option id -> value id */
  values: Record<string, string>;
};

export type ProductVariants = { options: VariantOption[]; variants: VariantDTO[] };

/**
 * Options and variants per product (session client, RLS-scoped: no cost field exists on these tables).
 * `productIds` omitted = every product of the workspace. Products without variants are absent from the map.
 */
export async function loadProductVariants(supabase: Db, productIds?: string[]): Promise<Map<string, ProductVariants>> {
  if (productIds && !productIds.length) return new Map();
  const optQ = supabase
    .from("product_options")
    .select("id, product_id, name, position, values:product_option_values(id, label, position)")
    .order("position")
    .order("position", { referencedTable: "product_option_values" });
  const varQ = supabase
    .from("product_variants")
    .select("id, product_id, sku, is_active, stock, created_at, vv:product_variant_values(option_id, value_id)")
    .order("created_at");
  const [{ data: opts }, { data: vars }] = await Promise.all([
    productIds ? optQ.in("product_id", productIds) : optQ,
    productIds ? varQ.in("product_id", productIds) : varQ,
  ]);

  const out = new Map<string, ProductVariants>();
  const entry = (pid: string) => {
    let e = out.get(pid);
    if (!e) out.set(pid, (e = { options: [], variants: [] }));
    return e;
  };
  for (const o of opts ?? []) {
    entry(o.product_id).options.push({
      id: o.id,
      name: o.name,
      values: [...o.values].sort((a, b) => a.position - b.position).map((v) => ({ id: v.id, label: v.label })),
    });
  }
  for (const v of vars ?? []) {
    const e = entry(v.product_id);
    const values = Object.fromEntries(v.vv.map((r) => [r.option_id, r.value_id]));
    e.variants.push({
      id: v.id,
      productId: v.product_id,
      sku: v.sku,
      isActive: v.is_active,
      stock: v.stock,
      values,
      label: variantLabel(e.options, values),
    });
  }
  // stable size order: by value position, option by option (created_at ties on migrated rows)
  for (const e of out.values()) {
    const rank = (v: VariantDTO) => e.options.map((o) => o.values.findIndex((x) => x.id === v.values[o.id]));
    e.variants.sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
      return 0;
    });
  }
  return out;
}
