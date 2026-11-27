/** CONF-4 callback helpers, shared by the action, the page and the sheet. */

import { ltr } from "@/lib/format";

export const ALGIERS_TZ = "Africa/Algiers";

/** An explicit Algiers date (`YYYY-MM-DD`) and time (`HH:MM`) as a UTC ISO instant; null when not a real one.
 * Africa/Algiers is UTC+1 all year (no DST), so the offset is fixed. */
export function algiersToIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const wall = new Date(`${date}T${time}:00Z`);
  // the round trip rejects dates JavaScript would roll over (31 February)
  if (Number.isNaN(wall.getTime()) || wall.toISOString().slice(0, 10) !== date) return null;
  return new Date(`${date}T${time}:00+01:00`).toISOString();
}

/** The Algiers date and time of an instant, as the two form fields want them. */
export function isoToAlgiers(iso: string | null): { date: string; time: string } {
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime())) return { date: "", time: "" };
  const local = new Date(at.getTime() + 3_600_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** dd/mm/yyyy HH:MM in Algiers, whatever the process or browser zone is. */
export function formatAlgiersDateTime(iso: string): string {
  const { date, time } = isoToAlgiers(iso);
  if (!date) return "—";
  const [y, m, d] = date.split("-");
  return ltr(`${d}/${m}/${y} ${time}`);
}
