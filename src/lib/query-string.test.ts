import { describe, expect, test } from "vitest";

import { COMMUNE_UNKNOWN_PARAM, drillHref, ISO_DATE, kpiFiltersJson, parseStatsFilters, statsFiltersToParams } from "./query-string";
import { DRILL_FILTER_KEYS } from "@/app/(app)/app/orders/orders-filter-bar";

describe("drillHref", () => {
  test("whole wilaya keeps period and product, no commune params", () => {
    const u = new URL(drillHref({ from: "2026-03-01", product: "p1" }, "delivered", { wilaya: 16 }), "http://x");
    expect(u.searchParams.get("drill")).toBe("delivered");
    expect(u.searchParams.get("wilaya_code")).toBe("16");
    expect(u.searchParams.get("from")).toBe("2026-03-01");
    expect(u.searchParams.get("product_id")).toBe("p1");
    expect(u.searchParams.has("commune_key")).toBe(false);
    expect(u.searchParams.has(COMMUNE_UNKNOWN_PARAM)).toBe(false);
  });
  test("a commune key is sent as is; a real commune named __unknown cannot collide with the unknown group", () => {
    const real = new URL(drillHref({}, "received", { wilaya: 16, communeKey: "__unknown" }), "http://x");
    expect(real.searchParams.get("commune_key")).toBe("__unknown");
    expect(real.searchParams.has(COMMUNE_UNKNOWN_PARAM)).toBe(false);
    const none = new URL(drillHref({}, "received", { wilaya: 16, communeKey: null }), "http://x");
    expect(none.searchParams.get(COMMUNE_UNKNOWN_PARAM)).toBe("1");
    expect(none.searchParams.has("commune_key")).toBe(false);
  });
  test("ISO_DATE rejects compact and padded dates", () => {
    expect(ISO_DATE.test("2026-03-10")).toBe(true);
    expect(ISO_DATE.test("20260310")).toBe(false);
  });
});

describe("normalized stats filters", () => {
  const U = "0A1B2C3D-0000-4000-8000-00000000ABCD";
  const read = (q: string) => { const p = new URLSearchParams(q); return parseStatsFilters((k) => p.get(k) ?? ""); };
  test("uppercase uuid and f_wilaya=06 normalize to the canonical params and SQL filter", () => {
    const f = read(`season=${U}&f_agent=${U}&f_wilaya=06&f_category=${U}&from=garbage`);
    const p = statsFiltersToParams(f);
    expect(p.get("season")).toBe(U.toLowerCase());
    expect(p.get("f_wilaya")).toBe("6");
    expect(p.has("from")).toBe(false);
    expect(kpiFiltersJson(f)).toEqual({ category: U.toLowerCase(), wilaya: "6", agent: U.toLowerCase() });
    expect(kpiFiltersJson(read(statsFiltersToParams(f).toString()))).toEqual(kpiFiltersJson(f));
  });
  test("leaving drill removes every statistics-only filter orders/all applies", () => {
    expect([...DRILL_FILTER_KEYS]).toEqual(["category", "conf_agent", "delivery_type"]);
  });
});
