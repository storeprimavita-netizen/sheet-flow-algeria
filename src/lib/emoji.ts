import { z } from "zod";

/** Bidi/zero-width controls: they can reorder or hide text, so neither emoji nor labels may carry them. */
// eslint-disable-next-line no-control-regex
const FORBIDDEN = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

export function graphemeCount(s: string): number {
  return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].length;
}

/** True when the text starts with an emoji (the status pill then hides its Lucide icon). */
export function startsWithEmoji(s: string): boolean {
  const first = new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s.trimStart())[Symbol.iterator]().next();
  return !first.done && PICTOGRAPHIC.test(first.value.segment);
}

/** Exactly one emoji grapheme; blank clears (null). */
export const emojiSchema = z
  .string()
  .trim()
  .max(16)
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (graphemeCount(v) === 1 && PICTOGRAPHIC.test(v) && !/[\u0000-\u001F\u200B\u200C\u200E\u200F\u202A-\u202E\u2066-\u2069]/.test(v)), {
    message: "Pick a single emoji",
  });

/** A display label: NFC, control/bidi stripped, trimmed, 1..40 chars. */
export const labelSchema = z
  .string()
  .transform((v) => v.normalize("NFC").replace(FORBIDDEN, "").trim())
  .pipe(z.string().min(1).max(40));
