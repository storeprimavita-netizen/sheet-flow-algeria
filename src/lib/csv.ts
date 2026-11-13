/**
 * Tiny CSV builder. Enough for the reports export — quotes fields that contain
 * a comma, quote, newline or leading/trailing space, and doubles internal
 * quotes per RFC 4180.
 */
export type CsvColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null | undefined;
};

function esc(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]|^\s|\s$/.test(s)) return `"${s.replace(/"/g, '""')}"`;
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
