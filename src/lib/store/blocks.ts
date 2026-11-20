import { z } from "zod";

import { httpsUrl } from "./url";

/** Page blocks: plain text only. No HTML is ever stored or rendered. */
const text = (max: number) => z.string().trim().min(1).max(max);

/** Optional cell: the row-grid editor sends "" for a blank cell, which means "absent". */
const cell = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? undefined : v), z.string().trim().min(1).max(max).optional());

export const sizeguideRowSchema = z
  .object({ size: text(40), fits: cell(40), shoulders: cell(40), chest: cell(40), waist: cell(40), weight: cell(40) })
  .strict();
export const SIZEGUIDE_COLUMNS = ["fits", "shoulders", "chest", "waist", "weight"] as const;

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: text(120) }).strict(),
  z.object({ type: z.literal("text"), text: text(2000) }).strict(),
  z.object({ type: z.literal("image"), url: httpsUrl, alt: z.string().trim().max(200).default("") }).strict(),
  z.object({ type: z.literal("list"), items: z.array(text(200)).min(1).max(20) }).strict(),
  // related pages (ids); resolved by the DAL, only published pages of the same store
  z.object({ type: z.literal("related"), pageIds: z.array(z.uuid()).max(6) }).strict(),
  z
    .object({
      type: z.literal("sizeguide"),
      title: cell(80),
      rows: z.array(sizeguideRowSchema).min(1).max(12),
      note: cell(300),
    })
    .strict(),
  // approved reviews of the page's product, resolved by the DAL
  z.object({ type: z.literal("reviews") }).strict(),
]);
export type Block = z.infer<typeof blockSchema>;

export const MAX_BLOCKS_BYTES = 64 * 1024;

export const blocksSchema = z
  .array(blockSchema)
  .max(60)
  .refine((b) => b.filter((x) => x.type === "sizeguide").length <= 1, "one sizeguide block at most")
  .refine((b) => b.filter((x) => x.type === "reviews").length <= 1, "one reviews block at most")
  .refine((b) => new TextEncoder().encode(JSON.stringify(b)).length <= MAX_BLOCKS_BYTES, "blocks too large");

export const seoSchema = z
  .object({
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(300).optional(),
    image: httpsUrl.optional(),
  })
  .strict();
export type Seo = z.infer<typeof seoSchema>;
