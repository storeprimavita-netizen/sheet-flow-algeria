/**
 * Product options, values and variants (STORE-1, D54). Pure helpers + zod schemas, no React, no I/O.
 * The label builder mirrors `public.variant_label()` in SQL: values joined by " / ", ordered by option position.
 */
import { z } from "zod";

import { httpsUrl } from "@/lib/store/url";

export type OptionKind = "text" | "color";
export type OptionValue = { id: string; label: string; swatchColor?: string | null; swatchImage?: string | null };
export type VariantOption = { id: string; name: string; kind?: OptionKind; values: OptionValue[] };

/** A photo swatch is drawn with <img src>: no whitespace, quotes, brackets or backslashes (matches the DB CHECK). */
export const swatchImageSchema = httpsUrl.refine((v) => /^https:\/\/[^\s"'()<>\\]{1,2040}$/.test(v), "bad url");
export const swatchHexSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const uuid = z.string().uuid();

const valueSchema = z.object({
  id: uuid,
  label: z.string().trim().min(1).max(60),
  swatch_color: swatchHexSchema.nullish().transform((v) => v ?? null),
  swatch_image: swatchImageSchema.nullish().transform((v) => v ?? null),
});

const optionSchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["text", "color"]).default("text"),
  values: z.array(valueSchema).min(1).max(40),
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
  /** true for a size that already exists in the database: its copy of a backfilled value must equal the backfill */
  existing: z.boolean().optional(),
});

export const variantConfigSchema = z
  .object({
    options: z.array(optionSchema).max(3),
    variants: z.array(variantSchema).max(200),
    /** new option id -> the value every existing size gets (VAR-1) */
    backfill: z.record(uuid, uuid).default({}),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    for (const o of cfg.options) {
      if (ids.has(o.id)) fail("duplicate_id");
      ids.add(o.id);
      for (const v of o.values) {
        if (v.swatch_color && v.swatch_image) fail("swatch_both");
        if ((v.swatch_color || v.swatch_image) && o.kind !== "color") fail("swatch_kind");
      }
      const labels = new Set<string>();
      for (const v of o.values) {
        if (ids.has(v.id)) fail("duplicate_id");
        ids.add(v.id);
        const key = v.label.toLowerCase();
        if (labels.has(key)) fail("duplicate_value");
        labels.add(key);
      }
    }
    if (cfg.options.filter((o) => o.kind === "color").length > 1) fail("one_color");
    if (cfg.variants.length && !cfg.options.length) fail("variant_values");
    for (const [optionId, valueId] of Object.entries(cfg.backfill)) {
      const o = cfg.options.find((x) => x.id === optionId);
      if (!o || !o.values.some((x) => x.id === valueId)) fail("backfill");
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
      if (v.existing) for (const [optionId, valueId] of Object.entries(cfg.backfill)) if (v.values[optionId] !== valueId) fail("backfill");
      const sig = cfg.options.map((o) => v.values[o.id]).join("|");
      if (sets.has(sig)) fail("duplicate_variant");
      sets.add(sig);
    }
  });

export type VariantConfig = z.infer<typeof variantConfigSchema>;

/** Reusable size names (Settings -> Options). Mirrors the DB CHECK: 1-40 items, trimmed, non-blank, <= 60 chars. */
export const sizeSetSchema = z.object({
  name: z.string().trim().min(1).max(60),
  items: z
    .array(z.string().trim().min(1).max(60))
    .min(1)
    .max(40),
});

/** Merge a size set into an option: existing values stay (used ones untouched), only missing names are appended. */
export function mergeSizeSet(existing: string[], items: string[]): string[] {
  const have = new Set(existing.map((e) => e.toLowerCase()));
  const out: string[] = [];
  for (const i of items) {
    const k = i.toLowerCase();
    if (!have.has(k)) {
      have.add(k);
      out.push(i);
    }
  }
  return out;
}

/**
 * "ABA-M-RED": product code + one part per option value. A Latin label gives up to 3 letters/digits;
 * anything else (Arabic...) falls back to its position among the option's values. Collisions get -2, -3.
 * The caller never applies a suggestion over a SKU the owner edited without asking.
 */
export function skuSuggestion(code: string, parts: { label: string; index: number }[], taken: Iterable<string>): string {
  const used = new Set([...taken].map((t) => t.toUpperCase()));
  const part = (p: { label: string; index: number }) => {
    const latin = p.label.normalize("NFKD").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return latin ? latin.slice(0, 3) : String(p.index + 1);
  };
  const base = [code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8), ...parts.map(part)].filter(Boolean).join("-") || "SKU";
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

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

/** A text option whose name is "Size" / "Variant" / "المقاس" (any locale, any case) already is the size option. */
const SIZE_NAMES = new Set(["size", "variant", "المقاس", "مقاس"]);
export function isSizeOption(o: { name: string; kind?: OptionKind }): boolean {
  return o.kind !== "color" && SIZE_NAMES.has(o.name.trim().toLowerCase());
}
