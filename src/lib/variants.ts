/**
 * Product options, values and variants (STORE-1, D54). Pure helpers + zod schemas, no React, no I/O.
 * The label builder mirrors `public.variant_label()` in SQL: values joined by " / ", ordered by option position.
 */
import { z } from "zod";

export type VariantOption = { id: string; name: string; values: { id: string; label: string }[] };

export const uuid = z.string().uuid();

const optionSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(60),
  values: z
    .array(z.object({ id: uuid, label: z.string().trim().min(1).max(60) }))
    .min(1)
    .max(40),
});

const variantSchema = z.object({
  id: uuid,
  sku: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .transform((v) => v || null),
  is_active: z.boolean(),
  /** option id -> value id; every option needs exactly one value */
  values: z.record(uuid, uuid),
});

export const variantConfigSchema = z
  .object({
    options: z.array(optionSchema).max(3),
    variants: z.array(variantSchema).max(200),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const o of cfg.options) {
      if (ids.has(o.id)) fail("duplicate_id");
      ids.add(o.id);
      const labels = new Set<string>();
      for (const v of o.values) {
        if (ids.has(v.id)) fail("duplicate_id");
        ids.add(v.id);
        const key = v.label.toLowerCase();
        if (labels.has(key)) fail("duplicate_value");
        labels.add(key);
      }
    }
    const valueOf = new Map(cfg.options.flatMap((o) => o.values.map((v) => [v.id, o.id] as const)));
    const sets = new Set<string>();
    const variantIds = new Set<string>();
    for (const v of cfg.variants) {
      if (variantIds.has(v.id)) fail("duplicate_id");
      variantIds.add(v.id);
      for (const o of cfg.options) {
        const chosen = v.values[o.id];
        if (!chosen || valueOf.get(chosen) !== o.id) fail("variant_values");
      }
      if (Object.keys(v.values).length !== cfg.options.length) fail("variant_values");
      const sig = cfg.options.map((o) => v.values[o.id]).join("|");
      if (sets.has(sig)) fail("duplicate_variant");
      sets.add(sig);
    }
  });

export type VariantConfig = z.infer<typeof variantConfigSchema>;

/** Absolute counts typed on the shelf: one entry per size. */
export const countBySizeSchema = z.array(z.object({ variant_id: uuid, count: z.number().int().min(0).max(1_000_000) })).min(1).max(200);

/** "S / Red": stable order = option order, never the order values were clicked. */
export function variantLabel(options: VariantOption[], values: Record<string, string>): string {
  return options
    .map((o) => o.values.find((v) => v.id === values[o.id])?.label)
    .filter((l): l is string => !!l)
    .join(" / ");
}

/** Every combination of values that no variant covers yet (editor's "Add missing sizes"). */
export function missingCombos(options: VariantOption[], existing: Record<string, string>[]): Record<string, string>[] {
  if (!options.length || options.some((o) => !o.values.length)) return [];
  const combos = options.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((c) => o.values.map((v) => ({ ...c, [o.id]: v.id }))),
    [{}],
  );
  const have = new Set(existing.map((e) => options.map((o) => e[o.id]).join("|")));
  return combos.filter((c) => !have.has(options.map((o) => c[o.id]).join("|")));
}

/**
 * "count needed" (D54.3): the product has variants and a size is below 0 or some pieces are
 * still not assigned to a size. Mirrors `product_variant_stock_v.count_needed` for client previews.
 */
export function variantStatus(stocks: number[], notAssigned: number): "no_variants" | "count_needed" | "ok" {
  if (!stocks.length) return "no_variants";
  return stocks.some((s) => s < 0) || notAssigned !== 0 ? "count_needed" : "ok";
}

/** What is left after a count, computed on the server's numbers: total - sum(all variants). */
export function notAssigned(total: number, variantStocks: number[]): number {
  return total - variantStocks.reduce((n, s) => n + s, 0);
}
