import { z } from "zod";

import { httpsUrl } from "./url";

/** Page blocks: plain text only. No HTML is ever stored or rendered. */
const text = (max: number) => z.string().trim().min(1).max(max);

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("heading"), text: text(120) }).strict(),
  z.object({ type: z.literal("text"), text: text(2000) }).strict(),
  z.object({ type: z.literal("image"), url: httpsUrl, alt: z.string().trim().max(200).default("") }).strict(),
  z.object({ type: z.literal("list"), items: z.array(text(200)).min(1).max(20) }).strict(),
  // related pages (ids); resolved by the DAL, only published pages of the same store
  z.object({ type: z.literal("related"), pageIds: z.array(z.uuid()).max(6) }).strict(),
]);
export type Block = z.infer<typeof blockSchema>;

export const MAX_BLOCKS_BYTES = 64 * 1024;

export const blocksSchema = z
  .array(blockSchema)
  .max(60)
  .refine((b) => new TextEncoder().encode(JSON.stringify(b)).length <= MAX_BLOCKS_BYTES, "blocks too large");

export const seoSchema = z
  .object({
    title: z.string().trim().max(120).optional(),
    description: z.string().trim().max(300).optional(),
    image: httpsUrl.optional(),
  })
  .strict();
export type Seo = z.infer<typeof seoSchema>;
