import { describe, expect, test } from "vitest";

import { blocksSchema, seoSchema } from "./blocks";
import { storeSettingsSchema, waLink } from "./settings";
import { httpsUrl, storeSlugSchema, stripEmoji } from "./url";

describe("store schemas", () => {
  test("javascript: and http url rejected", () => {
    for (const u of ["javascript:alert(1)", "http://x.com/a.jpg", "data:text/html,x", "//x.com", "not a url"]) {
      expect(httpsUrl.safeParse(u).success, u).toBe(false);
      expect(blocksSchema.safeParse([{ type: "image", url: u, alt: "" }]).success, u).toBe(false);
      expect(seoSchema.safeParse({ image: u }).success, u).toBe(false);
    }
    expect(httpsUrl.safeParse("https://x.com/a.jpg").success).toBe(true);
  });

  test("oversize block rejected", () => {
    const big = Array.from({ length: 40 }, () => ({ type: "text" as const, text: "a".repeat(2000) }));
    expect(blocksSchema.safeParse(big).success).toBe(false);
    expect(blocksSchema.safeParse([{ type: "text", text: "ok" }]).success).toBe(true);
  });

  test("blocks are strict text: unknown keys and types refused", () => {
    expect(blocksSchema.safeParse([{ type: "text", text: "x", html: "<b>" }]).success).toBe(false);
    expect(blocksSchema.safeParse([{ type: "html", text: "x" }]).success).toBe(false);
  });

  test("settings strict, wa.me from digits only", () => {
    expect(storeSettingsSchema.safeParse({ whatsapp: "213550000000", instagram: "luxe.modesty" }).success).toBe(true);
    expect(storeSettingsSchema.safeParse({ secret: "x" }).success).toBe(false);
    expect(storeSettingsSchema.safeParse({ whatsapp: "+213 55" }).success).toBe(false);
    expect(storeSettingsSchema.safeParse({ instagram: "a/b" }).success).toBe(false);
    expect(waLink("213550000000")).toBe("https://wa.me/213550000000");
  });

  test("slugs and emoji", () => {
    for (const s of ["app", "s", "A-b", "a", "x_y"]) expect(storeSlugSchema.safeParse(s).success, s).toBe(false);
    expect(storeSlugSchema.safeParse("luxe-1").success).toBe(true);
    expect(stripEmoji("عباية ✨ فاخرة 🌸")).toBe("عباية فاخرة");
  });
});
