import { parseStatsFilters, statsFiltersToParams, type StatsFilters } from "@/lib/query-string";
import type { SeasonResolution } from "@/lib/seasons";

/** The filters the bar shows and re-sends: a season the server rejected (deleted, stale) and a year
 * without a valid season are dropped, so they never come back through chip edits or localStorage. */
export function activeStatsFilters(f: StatsFilters, season: Pick<SeasonResolution, "season" | "invalid">): StatsFilters {
  return { ...f, season: season.season?.id, year: season.season && !season.invalid.year ? f.year : undefined };
}

/** Only values the server accepts are kept; the open drill `wilaya` panel passes through. */
export function cleanStatsParams(raw: URLSearchParams): URLSearchParams {
  const clean = statsFiltersToParams(parseStatsFilters((k) => raw.get(k) ?? ""));
  if (raw.get("wilaya")) clean.set("wilaya", raw.get("wilaya")!);
  return clean;
}

/** One edit (a chip removal or a select change) applied to the canonical params. */
export function editStatsParams(canon: URLSearchParams, openWilaya: string | null, edit: (p: URLSearchParams) => void): URLSearchParams {
  const next = new URLSearchParams(canon.toString());
  if (openWilaya) next.set("wilaya", openWilaya); // the open drill panel stays
  edit(next);
  return cleanStatsParams(next);
}
