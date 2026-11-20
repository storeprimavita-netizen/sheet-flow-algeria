/** Normalise for substring matching: case, diacritics, Arabic tashkeel/tatweel and letter variants. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
}

/** cmdk filter: 1 when the value or any keyword contains the query, else 0 (hidden). */
export function paletteFilter(value: string, search: string, keywords?: string[]): number {
  const q = normalizeSearch(search);
  if (!q) return 1;
  return [value, ...(keywords ?? [])].some((v) => normalizeSearch(v).includes(q)) ? 1 : 0;
}
