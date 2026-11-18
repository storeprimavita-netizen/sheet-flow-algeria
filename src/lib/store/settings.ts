import { z } from "zod";

/** Store contact and copy. Public: never put a secret here. */
const opt = (s: z.ZodString) => s.optional().or(z.literal("").transform(() => undefined));

const shape = z.object({
  phone: opt(z.string().trim().regex(/^[0-9+\s]{6,20}$/)),
  whatsapp: opt(z.string().trim().regex(/^[0-9]{8,15}$/)),
  instagram: opt(z.string().trim().regex(/^[A-Za-z0-9._]{1,30}$/)),
  announcement: opt(z.string().trim().max(160)),
  slogan: opt(z.string().trim().max(120)),
});

/** Write path: unknown keys are refused. */
export const storeSettingsSchema = shape.strict();
/** Read path: unknown keys are dropped, so a stray key can never reach the public DTO. */
export const publicSettingsSchema = shape;
export type StoreSettings = z.infer<typeof storeSettingsSchema>;

/** wa.me link built only from digits. */
export const waLink = (digits: string) => `https://wa.me/${digits.replace(/\D/g, "")}`;
export const instagramLink = (handle: string) => `https://instagram.com/${handle}`;
