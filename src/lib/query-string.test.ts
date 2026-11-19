import { describe, expect, test } from "vitest";

import { COMMUNE_UNKNOWN_PARAM, drillHref, ISO_DATE } from "./query-string";

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
