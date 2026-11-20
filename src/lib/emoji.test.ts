import { describe, expect, test } from "vitest";

import { emojiSchema, labelSchema, isEmojiOnly, startsWithEmoji } from "@/lib/emoji";

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

describe("flags and keycaps", () => {
  test("schema accepts them and startsWithEmoji sees them", () => {
    for (const e of ["🇩🇿", "#️⃣", "1️⃣"]) {
      expect(emojiSchema.parse(e)).toBe(e);
      expect(startsWithEmoji(`${e} Label`)).toBe(true);
    }
  });
  test("isEmojiOnly", () => {
    expect(isEmojiOnly("✅")).toBe(true);
    expect(isEmojiOnly("🇩🇿 ✅")).toBe(false);
    expect(isEmojiOnly("✅ Ok")).toBe(false);
    expect(isEmojiOnly("")).toBe(false);
  });
});
