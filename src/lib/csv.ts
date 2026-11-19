/**
 * Tiny CSV builder. Enough for the reports export — quotes fields that contain
 * a comma, semicolon, tab, quote, newline or leading/trailing space, and doubles internal
 * quotes per RFC 4180.
 */
export type CsvColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
};

function esc(v: string | number | null | undefined): string {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formulas: strings only, real numbers (e.g. -10274) stay numeric.
  // A leading +/- is safe only when the whole value is number-like (phones, amounts).
  if (typeof v === "string") {
    // Each segment (value start, and text after ; TAB CR LF) can open a cell in another reader.
    s = v.replace(/(^|[;\t\r\n])([^;\t\r\n]*)/g, (_m, sep: string, seg: string) => {
      const t = seg.replace(/^[\s"]+/, "");
      const formula = /^[=@\uFF1D]/.test(t) || (/^[+-]/.test(t) && !/^[+-]?\d[\d .]*$/.test(t));
      return formula ? `${sep}'${seg}` : sep + seg;
    });
    if (/^[\t\r]/.test(v)) s = `'${s}`;
  }
  if (/[",;\t\n\r]|^\s|\s$/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCSV<T>(columns: CsvColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => esc(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => esc(c.value(r))).join(","))
    .join("\r\n");
  return `${header}\r\n${body}`;
}

/** Trigger a browser download of `csv` as `filename`. */
export function downloadCSV(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
