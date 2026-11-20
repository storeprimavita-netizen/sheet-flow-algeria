import { describe, expect, test } from "vitest";

import { parseStatsFilters, statsFiltersToParams } from "@/lib/query-string";
import { resolveSeason, type SeasonRow } from "@/lib/seasons";
import { activeStatsFilters, editStatsParams } from "./stats-filter-edit";

const S = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const seasons: SeasonRow[] = [
  { id: S, name: "Eid", name_key: null, sort: 1, periods: [{ year: 2025, date_from: "2025-03-01", date_to: "2025-03-31" }, { year: 2026, date_from: "2026-03-01", date_to: "2026-03-31" }] },
];
const read = (q: string) => { const p = new URLSearchParams(q); return parseStatsFilters((k) => p.get(k) ?? ""); };
const active = (q: string) => {
  const f = read(q);
  return statsFiltersToParams(activeStatsFilters(f, resolveSeason({ season: f.season, year: f.year, from: f.from, to: f.to }, seasons)));
};

describe("statistics chip edits", () => {
  test("rejected season not persisted", () => {
    const stale = "33333333-3333-4333-8333-333333333333";
    expect(active(`season=${stale}&year=2026&product=${P}`).toString()).toBe(`product=${P}`);
    expect(active("year=2026").size).toBe(0);
  });
  test("chip removal keeps season and year", () => {
    const canon = active(`season=${S}&year=2025&product=${P}&f_wilaya=16`);
    expect(canon.get("year")).toBe("2025");
    const next = editStatsParams(canon, null, (p) => p.delete("f_wilaya"));
    expect(next.get("season")).toBe(S);
    expect(next.get("year")).toBe("2025");
    expect(next.get("product")).toBe(P);
    expect(next.has("f_wilaya")).toBe(false);
  });
  test("an invalid year is dropped, a valid season stays", () => {
    expect(active(`season=${S}&year=1999`).toString()).toBe(`season=${S}`);
  });
  test("the open drill wilaya panel survives an edit", () => {
    expect(editStatsParams(new URLSearchParams(`product=${P}`), "16", (p) => p.delete("product")).toString()).toBe("wilaya=16");
  });
});
