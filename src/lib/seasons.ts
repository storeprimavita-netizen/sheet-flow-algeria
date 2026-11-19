/**
 * Seasons (STATS-3): named date ranges per year, resolved SERVER-side from the URL.
 * Pure (no I/O) so it is unit-tested. year = year of the period's `date_from`.
 */
export type SeasonPeriod = { year: number; date_from: string; date_to: string };
export type SeasonRow = { id: string; name: string; name_key: string | null; sort: number; periods: SeasonPeriod[] };

export type SeasonResolution = {
  /** The effective range the SQL gets: explicit from/to when present, else the season period. */
  from?: string;
  to?: string;
  season: SeasonRow | null;
  /** The period of the chosen year (null when no season, or the season has no period). */
  period: SeasonPeriod | null;
  /** Explicit from/to are in the URL next to a season: the dates win and the chip says so. */
  overridden: boolean;
  /** What was dropped from the URL, for a visible note. */
  invalid: { season?: boolean; year?: boolean; noPeriods?: boolean };
};

/** Years that have a period, newest first. */
export const periodYears = (s: SeasonRow | null | undefined): number[] =>
  s ? [...new Set(s.periods.map((p) => p.year))].sort((a, b) => b - a) : [];

export function resolveSeason(
  input: { season?: string; year?: number; from?: string; to?: string },
  seasons: SeasonRow[],
): SeasonResolution {
  const invalid: SeasonResolution["invalid"] = {};
  const explicit = !!(input.from || input.to);
  const base = { from: input.from, to: input.to };

  let season: SeasonRow | null = null;
  if (input.season) {
    season = seasons.find((s) => s.id === input.season) ?? null;
    if (!season) invalid.season = true;
  }
  if (input.year !== undefined && !season) invalid.year = true;
  if (!season) return { ...base, season: null, period: null, overridden: false, invalid };

  const years = periodYears(season);
  if (years.length === 0) {
    invalid.noPeriods = true;
    return { ...base, season, period: null, overridden: false, invalid };
  }
  let year = input.year;
  if (year !== undefined && !years.includes(year)) {
    invalid.year = true;
    year = undefined;
  }
  const chosen = year ?? years[0];
  const period = season.periods.find((p) => p.year === chosen) ?? null;
  if (explicit) return { ...base, season, period, overridden: true, invalid };
  return { from: period?.date_from, to: period?.date_to, season, period, overridden: false, invalid };
}

/** Display name: the translated name of a seeded season (`name_key`), the stored name otherwise (admin-added). */
export function seasonLabel(
  t: { has: (key: string) => boolean; (key: string): string },
  s: { name: string; name_key: string | null },
): string {
  const key = s.name_key ? `seasons.names.${s.name_key}` : null;
  return key && t.has(key) ? t(key) : s.name;
}
