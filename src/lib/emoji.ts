import { z } from "zod";

/** Bidi/zero-width controls: they can reorder or hide text, so neither emoji nor labels may carry them. */
// U+200D (ZWJ) is NOT listed: family/profession emoji are joined with it.
// Mirrors the DB CHECKs in migration 00074.
const FORBIDDEN =
  // eslint-disable-next-line no-control-regex
  /[\u0000-\u001F\u007F-\u009F\u200B\u200C\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF\u2028\u2029\u00AD\u034F\u115F\u3164\u2800]/g;
const INVISIBLE = /\p{Default_Ignorable_Code_Point}/gu;
// pictographs, flags (regional-indicator pairs) and keycaps (e.g. 1️⃣)
const PICTOGRAPHIC = /\p{Extended_Pictographic}|\p{Regional_Indicator}{2}|[0-9#*]\uFE0F?\u20E3/u;

const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export function graphemeCount(s: string): number {
  return [...SEGMENTER.segment(s)].length;
}

/** True when the text starts with an emoji (the status pill then hides its Lucide icon). */
export function startsWithEmoji(s: string): boolean {
  const first = SEGMENTER.segment(s.trimStart())[Symbol.iterator]().next();
  return !first.done && PICTOGRAPHIC.test(first.value.segment);
}

/** True when the text is emoji only (no readable word), so it needs a screen-reader name. */
export function isEmojiOnly(s: string): boolean {
  const parts = [...SEGMENTER.segment(s.trim())].map((x) => x.segment);
  return parts.length > 0 && parts.every((g) => PICTOGRAPHIC.test(g));
}

// tag characters are legal only in the subdivision-flag sequence 🏴 + tags + cancel tag
const TAGS = /[\u{E0000}-\u{E007F}]/u;
const FLAG_TAG_SEQUENCE = /^\u{1F3F4}[\u{E0020}-\u{E007E}]+\u{E007F}$/u;

/** Exactly one emoji grapheme; blank clears (null). */
export const emojiSchema = z
  .string()
  .trim()
  .max(16)
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (graphemeCount(v) === 1 && PICTOGRAPHIC.test(v) && !/[\u0000-\u001F\u200B\u200C\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(v) && !v.endsWith("\u200D") && (!TAGS.test(v) || FLAG_TAG_SEQUENCE.test(v))), {
    message: "Pick a single emoji",
  });

/** The ONE label normaliser (server schema and live preview): NFC, control/bidi/filler stripped, trimmed. */
export function normalizeLabel(v: string): string {
  return v.normalize("NFC").replace(FORBIDDEN, "").trim();
}

/** Splits a leading emoji grapheme from the rest ("🔥 Hot" -> ["🔥", "Hot"]); null when the text does not start with one. */
export function splitLeadingEmoji(s: string): { emoji: string; rest: string } | null {
  const text = s.trimStart();
  const first = SEGMENTER.segment(text)[Symbol.iterator]().next();
  if (first.done || !PICTOGRAPHIC.test(first.value.segment)) return null;
  return { emoji: first.value.segment, rest: text.slice(first.value.segment.length).trim() };
}

/** A display label: normalised, 1..40 chars, not only invisible characters (ZWJ alone etc.). */
export const labelSchema = z
  .string()
  .transform(normalizeLabel)
  .pipe(z.string().min(1).max(40))
  .refine((v) => v.replace(INVISIBLE, "").trim() !== "", { message: "Label is invisible" });
