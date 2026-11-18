import { z } from "zod";

/** https-only absolute URL. `javascript:`, `data:` and plain `http:` are refused. */
export const httpsUrl = z
  .string()
  .max(2048)
  .refine((v) => {
    try {
      return new URL(v).protocol === "https:";
    } catch {
      return false;
    }
  }, "https only");

export const isHttps = (v: string) => httpsUrl.safeParse(v).success;

/** One URL-safe slug, shared by stores and pages (matches the DB CHECK). */
export const slugSchema = z.string().regex(/^[a-z0-9-]{2,40}$/);
export const RESERVED_STORE_SLUGS = ["app", "api", "login", "s", "auth"] as const;
export const storeSlugSchema = slugSchema.refine((v) => !(RESERVED_STORE_SLUGS as readonly string[]).includes(v));

/** Product names may carry emoji for the team; the store never shows them. */
export function stripEmoji(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}‍️⃣]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
