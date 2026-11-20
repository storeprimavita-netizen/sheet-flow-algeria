import { describe, expect, test } from "vitest";

import { emojiSchema, labelSchema, isEmojiOnly, normalizeLabel, splitLeadingEmoji, startsWithEmoji } from "@/lib/emoji";

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

describe("normalizeLabel parity with the DB set", () => {
  test("strips every code point the 00074 CHECK bans and keeps ZWJ", () => {
    for (const ch of ["\u061C", "\uFEFF", "\u2028", "\u2029", "\u00AD", "\u034F", "\u115F", "\u3164", "\u200B", "\u200E", "\u202E"]) {
      expect(normalizeLabel(`a${ch}b`)).toBe("ab");
    }
    const fam = "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}";
    expect(normalizeLabel(` ${fam} `)).toBe(fam);
    expect(labelSchema.parse(`${fam} x`)).toBe(`${fam} x`);
  });
  test("a label of only invisible characters is invalid", () => {
    for (const bad of ["\u3164", "\uFEFF\u061C", "\u200D", "\u2028 \u00AD\u034F\u115F"]) expect(labelSchema.safeParse(bad).success).toBe(false);
  });
});

describe("splitLeadingEmoji", () => {
  test("splits the first grapheme, else null", () => {
    expect(splitLeadingEmoji("🔥 Hot")).toEqual({ emoji: "🔥", rest: "Hot" });
    expect(splitLeadingEmoji("👩\u200D👩\u200D👧Family")).toEqual({ emoji: "👩\u200D👩\u200D👧", rest: "Family" });
    expect(splitLeadingEmoji("🔥")).toEqual({ emoji: "🔥", rest: "" });
    expect(splitLeadingEmoji("Hot 🔥")).toBeNull();
  });
});
