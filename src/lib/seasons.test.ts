import { describe, expect, test } from "vitest";

import { resolveSeason, periodYears, type SeasonRow } from "./seasons";
import {
  DASHBOARD_PERSIST_KEYS, STATS_PERSIST_KEYS, kpiFiltersJson, ordersQs, parseStatsFilters, pickParams,
  statsDrillFilters, drillHref,
} from "./query-string";

const RAMADAN = "11111111-1111-4111-8111-111111111111";
const SEASONS: SeasonRow[] = [
  {
    id: RAMADAN, name: "Ramadan", name_key: "ramadan", sort: 0,
    periods: [
      { year: 2025, date_from: "2025-03-01", date_to: "2025-03-30" },
      { year: 2026, date_from: "2026-02-18", date_to: "2026-03-19" },
    ],
  },
  { id: "22222222-2222-4222-8222-222222222222", name: "Winter", name_key: null, sort: 1, periods: [] },
];

describe("resolveSeason", () => {
  test("season + year -> that period", () => {
    const r = resolveSeason({ season: RAMADAN, year: 2025 }, SEASONS);
    expect([r.from, r.to, r.overridden]).toEqual(["2025-03-01", "2025-03-30", false]);
  });
  test("season without year -> latest year with a period", () => {
    const r = resolveSeason({ season: RAMADAN }, SEASONS);
    expect(r.period?.year).toBe(2026);
    expect(r.from).toBe("2026-02-18");
  });
  test("unknown season and year without season are dropped with a flag", () => {
    const a = resolveSeason({ season: "33333333-3333-4333-8333-333333333333" }, SEASONS);
    expect(a.invalid.season).toBe(true);
    expect(a.season).toBeNull();
    expect(resolveSeason({ year: 2025 }, SEASONS).invalid.year).toBe(true);
  });
  test("a year without a period is dropped, the latest year is used", () => {
    const r = resolveSeason({ season: RAMADAN, year: 2019 }, SEASONS);
    expect(r.invalid.year).toBe(true);
    expect(r.period?.year).toBe(2026);
  });
  test("explicit dates override the season and say so", () => {
    const r = resolveSeason({ season: RAMADAN, year: 2025, from: "2025-01-01", to: "2025-01-31" }, SEASONS);
    expect([r.from, r.to, r.overridden]).toEqual(["2025-01-01", "2025-01-31", true]);
  });
  test("a season without periods keeps the explicit range and flags it", () => {
    const r = resolveSeason({ season: SEASONS[1].id }, SEASONS);
    expect(r.invalid.noPeriods).toBe(true);
    expect(r.from).toBeUndefined();
  });
  test("year options are the years with a period, newest first", () => {
    expect(periodYears(SEASONS[0])).toEqual([2026, 2025]);
    expect(periodYears(null)).toEqual([]);
  });
});

const parse = (qs: string) => {
  const sp = new URLSearchParams(qs);
  return parseStatsFilters((k) => sp.get(k) ?? "");
};

describe("parseStatsFilters", () => {
  test("f_wilaya is a filter, wilaya (open drill) is not", () => {
    const f = parse("f_wilaya=16&wilaya=31");
    expect(f.wilaya).toBe("16");
    expect(kpiFiltersJson(f)).toEqual({ wilaya: "16" });
  });
  test("invalid values are dropped; uuids lowercased", () => {
    const f = parse(`f_wilaya=99&f_source=foo&f_delivery=x&f_agent=nope&f_category=${RAMADAN.toUpperCase()}&year=20x6&from=2025-1-1`);
    expect(f).toMatchObject({ wilaya: undefined, source: undefined, delivery: undefined, agent: undefined, category: RAMADAN, year: undefined, from: undefined });
    expect(kpiFiltersJson(parse(""))).toBeUndefined();
  });
  test("filters survive ordersQs and drillHref; agent maps to conf_agent, category and delivery are carried", () => {
    const f = parse(`f_category=${RAMADAN}&f_agent=${RAMADAN}&f_delivery=home&f_source=manual&product=${RAMADAN}`);
    const qs = new URLSearchParams(ordersQs(statsDrillFilters(f, { from: "2026-01-01", to: "2026-01-31" })).split("?")[1]);
    expect(Object.fromEntries(qs)).toMatchObject({
      from: "2026-01-01", to: "2026-01-31", product_id: RAMADAN, source: "manual", category: RAMADAN, conf_agent: RAMADAN, delivery_type: "home",
    });
    expect(qs.has("agent")).toBe(false);
    const d = new URLSearchParams(drillHref(statsDrillFilters(f, {}), "received", { wilaya: 16 }).split("?")[1]);
    expect(d.get("wilaya_code")).toBe("16");
    expect(d.get("drill")).toBe("received");
    expect(d.get("conf_agent")).toBe(RAMADAN);
  });
});

describe("persisted filters", () => {
  test("stats allow-list drops the open drill wilaya; year needs a season", () => {
    expect(pickParams(`wilaya=16&f_wilaya=31&season=${RAMADAN}&year=2025&x=1`, STATS_PERSIST_KEYS))
      .toBe(`season=${RAMADAN}&year=2025&f_wilaya=31`);
    expect(pickParams(`season=${RAMADAN}`, STATS_PERSIST_KEYS)).toBe(`season=${RAMADAN}`);
    expect(pickParams("year=2025", STATS_PERSIST_KEYS)).toBe("");
  });
  test("dashboard restore ignores stats keys", () => {
    expect(pickParams(`from=2026-01-01&f_wilaya=16&season=${RAMADAN}&year=2025&product=${RAMADAN}`, DASHBOARD_PERSIST_KEYS))
      .toBe(`from=2026-01-01&product=${RAMADAN}`);
  });
});
