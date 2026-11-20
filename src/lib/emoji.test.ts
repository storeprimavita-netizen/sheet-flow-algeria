import { describe, expect, test } from "vitest";

import { emojiSchema, labelSchema, startsWithEmoji } from "@/lib/emoji";

describe("emojiSchema", () => {
  test("one grapheme, including ZWJ and skin-tone sequences", () => {
    for (const e of ["🔥", "👩‍👩‍👧", "👍🏽", "❤️"]) expect(emojiSchema.parse(e)).toBe(e);
  });
  test("blank clears; two emoji, text, bidi and control are rejected", () => {
    expect(emojiSchema.parse("  ")).toBeNull();
    for (const bad of ["🔥🔥", "a", "‮🔥", "🔥​", "🔥\u0007"]) expect(emojiSchema.safeParse(bad).success).toBe(false);
  });
});

describe("labelSchema", () => {
  test("NFC, trims, strips control and bidi, 1..40", () => {
    expect(labelSchema.parse("  é ‮ok​ ")).toBe("é ok");
    expect(labelSchema.safeParse("   ").success).toBe(false);
    expect(labelSchema.safeParse("x".repeat(41)).success).toBe(false);
  });
});

describe("startsWithEmoji", () => {
  test("detects a leading emoji only", () => {
    expect(startsWithEmoji("🔥 Hot")).toBe(true);
    expect(startsWithEmoji("Hot 🔥")).toBe(false);
    expect(startsWithEmoji("")).toBe(false);
  });
});
