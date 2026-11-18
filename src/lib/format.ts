/** Locale-neutral display helpers. Algeria → DA. */

const NBSP = "\u00a0";

/** Whole dinars, space-grouped, never wraps: `135 900 DA` (pass a localized `unit`, e.g. "دج"). `-0` renders `0`. */
export function formatCurrency(
  value: number | string | null | undefined,
  unit = "DA",
): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw)) return "—";
  const n = Math.round(raw) || 0; // || 0 folds -0
  return ltr(`${n.toLocaleString("en-US").replace(/,/g, NBSP)}${NBSP}${unit}`);
}

/** Whole number, space-grouped, no unit, isolated for RTL: `135 900`. */
export function formatInt(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const n = Math.round(value) || 0;
  return ltr(n.toLocaleString("en-US").replace(/,/g, NBSP));
}

/** US dollars, comma-grouped, isolated for RTL: `$1,234` (whole) or `$2.20` with `{ decimals: 2 }`. */
export function formatUsd(value: number | string | null | undefined, opts: { decimals?: number } = {}): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw)) return "—";
  const decimals = opts.decimals ?? 0;
  const f = 10 ** decimals;
  const n = Math.round(raw * f) / f || 0;
  const body = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return ltr(`${n < 0 ? "−" : ""}$${body}`);
}

/** Wrap in Unicode LTR isolates (LRI…PDI) so a number keeps its order inside
 * Arabic text: "−349 067 DA" never becomes "DA 349 067", "-391.4%" stays put. */
export const ltr = (s: string) => `\u2066${s}\u2069`;

/** "48.1%", isolated for RTL. Pass to templates without their own "%". */
export function formatPercent(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : ltr(`${value}%`);
}

/** dd/mm/yyyy — the Algerian convention, same in AR and EN. A bare
 * `YYYY-MM-DD` is read as a local calendar date (no UTC day shift). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseDate(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB");
}

function parseDate(s: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-GB")} ${d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/** "4 minutes ago" / "in 3 days" — native Intl, correct grammar in ar too. */
export function formatRelativeTime(value: string | Date | null | undefined, locale = "en"): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

/** Postgres `interval` text (e.g. "3 days 01:02:03", "01:02:03") → "3d 1h", "45m". */
export function formatDuration(value: string | null | undefined): string {
  if (!value) return "—";
  let seconds = 0;
  const days = value.match(/(-?\d+)\s+days?/);
  if (days) seconds += parseInt(days[1], 10) * 86400;
  const hms = value.match(/(-?\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (hms) seconds += Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.round((seconds % 3600) / 60);
  const parts = [d && `${d}d`, h && `${h}h`, (m || (!d && !h)) && `${m}m`].filter(Boolean);
  return parts.join(" ");
}

/** Per-workspace running order number (D57): `#0001`, grows past 9999, `—` when unnumbered.
 * Plain text (CSV-safe); in the UI wrap in `<bdi dir="ltr">`. */
export function formatOrderNo(seq: number | null | undefined): string {
  if (seq === null || seq === undefined || !Number.isInteger(seq) || seq <= 0) return "—";
  return `#${String(seq).padStart(4, "0")}`;
}
