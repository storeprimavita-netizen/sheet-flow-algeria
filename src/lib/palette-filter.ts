/**
 * Normalise for substring matching: case, diacritics, Arabic tashkeel/tatweel and letter variants.
 * NFKD splits أ إ آ ؤ ئ into the base letter + a combining mark, which the strip removes,
 * so those fold to ا و ي without a dedicated replace.
 */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    // U+0300-036F combining marks, U+0640 tatweel, U+064B-065F tashkeel, U+0670 dagger alef
    .replace(/[\u0300-\u036F\u0640\u064B-\u065F\u0670]/g, "")
    .replace(/\u0649/g, "\u064A") // alef maksura -> yeh
    .replace(/\u06CC/g, "\u064A") // Persian yeh -> Arabic yeh
    .replace(/\u06A9/g, "\u0643") // Persian keheh -> Arabic kaf
    .replace(/\u0629/g, "\u0647") // ta marbuta -> heh
    .trim();
}

/** cmdk filter: 1 when the value or any keyword contains the query, else 0 (hidden). */
export function paletteFilter(value: string, search: string, keywords?: string[]): number {
  const q = normalizeSearch(search);
  if (!q) return 1;
  return [value, ...(keywords ?? [])].some((v) => normalizeSearch(v).includes(q)) ? 1 : 0;
}

/** True when at least one row survives the filter for this query. */
export function hasPaletteMatch(rows: { value: string; keywords?: string[] }[], search: string): boolean {
  return rows.some((r) => paletteFilter(r.value, search, r.keywords) === 1);
}

