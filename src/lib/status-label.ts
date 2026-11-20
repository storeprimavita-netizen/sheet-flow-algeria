import type { StatusKind } from "@/lib/statuses";

export type StatusLabelLocale = "en" | "ar";
export type StatusLabelOverrides = Partial<Record<StatusKind, Record<string, { en: string | null; ar: string | null }>>>;

/**
 * Pure: the override for this language, else `fallback` (the translated default).
 * Own-property lookups only, so a key like `__proto__` can never resolve; one
 * language never falls back to the other.
 */
export function resolveStatusLabel(
  overrides: StatusLabelOverrides | null | undefined,
  kind: StatusKind,
  key: string,
  locale: string,
  fallback: string,
): string {
  if (!overrides || !Object.hasOwn(overrides, kind)) return fallback;
  const byKey = overrides[kind];
  if (!byKey || !Object.hasOwn(byKey, key)) return fallback;
  const entry = byKey[key];
  const text = locale === "ar" ? entry.ar : locale === "en" ? entry.en : null;
  return text && text.trim() ? text : fallback;
}
