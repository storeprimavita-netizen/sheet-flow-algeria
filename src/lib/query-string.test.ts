import { describe, expect, test } from "vitest";

import { communeLinkable, COMMUNE_UNKNOWN_PARAM, drillHref, ISO_DATE, isRealIsoDate, MAX_COMMUNE_KEY, kpiFiltersJson, ordersQs, parseStatsFilters, statsDrillFilters, statsFiltersToParams } from "./query-string";
import { dropOneKey, leaveDrillKeys } from "@/app/(app)/app/sell/orders/_lib/drill-filters";

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
  test("product-first and wilaya-first links keep the resolved dates and full cohort", () => {
    const common = `season=${U}&year=2026&f_category=${U}&f_agent=${U}&f_source=manual&f_delivery=home`;
    const range = { from: "2026-03-10", to: "2026-03-16" };
    const productScope = statsDrillFilters(read(`${common}&product=${U}`), range);
    const wilayaScope = statsDrillFilters(read(`${common}&f_wilaya=06`), range);
    for (const drill of ["delivered", "shipped"]) {
      const expected = {
        ...range, product_id: U.toLowerCase(), wilaya_code: "6", source: "manual",
        category: U.toLowerCase(), conf_agent: U.toLowerCase(), delivery_type: "home", drill,
      };
      for (const href of [
        ordersQs(productScope, { wilaya_code: "6", drill }),
        ordersQs(wilayaScope, { product_id: U.toLowerCase(), drill }),
      ]) {
        expect(Object.fromEntries(new URL(href, "http://x").searchParams)).toEqual(expected);
      }
    }
  });
  const qs = "drill=received&commune_key=x&category=c&conf_agent=a&delivery_type=home&wilaya_code=16&page=2";
  test("leaveDrill removes drill params and the three key filters in drill mode", () => {
    expect(leaveDrillKeys(new URLSearchParams(qs), true).toString()).toBe("wilaya_code=16&page=2");
  });
  test("leaveDrill keeps drill filters outside drill mode", () => {
    expect(leaveDrillKeys(new URLSearchParams("category=c&conf_agent=a&delivery_type=home&wilaya_code=16"), false).toString())
      .toBe("category=c&conf_agent=a&delivery_type=home&wilaya_code=16");
  });
  test("dropOne removes exactly one key", () => {
    expect(dropOneKey(new URLSearchParams(qs), "conf_agent").toString())
      .toBe("drill=received&commune_key=x&category=c&delivery_type=home&wilaya_code=16");
  });
});

describe("impossible values", () => {
  test("rejects impossible dates (2026-02-30) on statistics + drill params", () => {
    expect(isRealIsoDate("2026-02-30")).toBe(false);
    expect(isRealIsoDate("2026-13-01")).toBe(false);
    expect(isRealIsoDate("2024-02-29")).toBe(true);
    const f = parseStatsFilters((k) => ({ from: "2026-02-30", to: "2026-03-01" })[k] ?? "");
    expect(f.from).toBeUndefined();
    expect(f.to).toBe("2026-03-01");
  });
  test("communeLinkable false over 120", () => {
    expect(communeLinkable("a".repeat(MAX_COMMUNE_KEY))).toBe(true);
    expect(communeLinkable("a".repeat(MAX_COMMUNE_KEY + 1))).toBe(false);
  });
  test("shipped drill carries delivery_type and the display label", () => {
    const u = new URL(drillHref({}, "shipped", { wilaya: 16, communeKey: "bab", communeLabel: "Bab Ezzouar", deliveryType: "home" }), "http://x");
    expect(u.searchParams.get("drill")).toBe("shipped");
    expect(u.searchParams.get("delivery_type")).toBe("home");
    expect(u.searchParams.get("commune_label")).toBe("Bab Ezzouar");
  });
});
