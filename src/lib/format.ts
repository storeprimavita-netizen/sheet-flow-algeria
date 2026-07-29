/** Locale-neutral display helpers. Algeria → DZD. */

export function formatCurrency(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} DZD`;
}

/** YYYY-MM-DD — unambiguous in both AR and EN contexts. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-CA");
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-CA")} ${d.toLocaleTimeString("en-GB", {
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
