import { z } from "zod";

import { deliveryMethodsSchema, formFieldsSchema } from "./form-fields";
import { stripEmoji } from "./url";

/** Input contracts of the product Selling tab. Whole DZD only; nothing derived comes from the browser. */
const uuid = z.uuid();
const dzd = z.number().int().min(0).max(10_000_000);
const plainLabel = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .refine((v) => !/[<>]/.test(v) && stripEmoji(v) === v, "plain text");
const date = z.iso.datetime({ offset: true }).nullable();

export const MAX_QUANTITY_OFFERS = 6;

export const pricingInputSchema = z
  .object({
    productId: uuid,
    mode: z.enum(["uniform", "per_value", "per_variant"]),
    compareAt: dzd.nullable(),
    deltas: z.array(z.object({ valueId: uuid, delta: z.number().int().min(-10_000_000).max(10_000_000) }).strict()).max(200),
    overrides: z.array(z.object({ variantId: uuid, price: dzd.nullable(), compareAt: dzd.nullable() }).strict()).max(200),
  })
  .strict();

type PricingState = {
  productId: string;
  mode: "uniform" | "per_value" | "per_variant";
  compareAt: number | null;
  deltas: Record<string, number>;
  overrides: Record<string, { price: number | null; compare: number | null }>;
  variantIds: string[];
};

/** What the editor sends on save. Only the active mode keeps its numbers: every other delta/override goes out as 0/null so the DB never keeps a price the page no longer shows. */
export function buildPricingPayload(s: PricingState): z.input<typeof pricingInputSchema> {
  return {
    productId: s.productId,
    mode: s.mode,
    compareAt: s.compareAt,
    deltas: Object.entries(s.deltas).map(([valueId, delta]) => ({ valueId, delta: s.mode === "per_value" ? delta : 0 })),
    overrides: s.variantIds.map((variantId) => ({
      variantId,
      price: s.mode === "per_variant" ? (s.overrides[variantId]?.price ?? null) : null,
      compareAt: s.mode === "per_variant" ? (s.overrides[variantId]?.compare ?? null) : null,
    })),
  };
}

const quantityOffer = z
  .object({
    id: uuid.nullable(),
    label: plainLabel,
    qty: z.number().int().min(2).max(50),
    total: z.number().int().min(1).max(10_000_000),
    isDefault: z.boolean(),
    isActive: z.boolean(),
    activeFrom: date,
    activeTo: date,
  })
  .strict()
  .refine((o) => !o.activeFrom || !o.activeTo || new Date(o.activeFrom) < new Date(o.activeTo), { path: ["activeTo"], message: "window" });

export const offersInputSchema = z
  .object({
    productId: uuid,
    offers: z.array(quantityOffer).max(MAX_QUANTITY_OFFERS),
    bump: z
      .object({ productId: uuid, price: z.number().int().min(1).max(10_000_000), label: plainLabel, isActive: z.boolean() })
      .strict()
      .nullable(),
  })
  .strict()
  .refine((v) => v.offers.filter((o) => o.isDefault).length <= 1, { path: ["offers"], message: "one default" });

export const formInputSchema = z.object({ productId: uuid, fields: formFieldsSchema, deliveryMethods: deliveryMethodsSchema }).strict();

export type SellingResult = { ok: true } | { ok: false; error: "invalid" | "notFound" | "forbidden" | "bump" | "failed" };
