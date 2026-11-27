import { describe, expect, test } from "vitest";

import { parseFinanceFilters } from "./finance-filters";

describe("finance URL filters", () => {
  test("keeps valid values", () => {
    const valid = { from: "2026-02-01", to: "2026-02-28", product: crypto.randomUUID(), category: "shooting", kind: "test" };
    expect(parseFinanceFilters(valid)).toEqual(valid);
  });

  test("ignores impossible dates, repeated params, bad ids and unknown enum values", () => {
    const parsed = parseFinanceFilters({ from: "2026-02-30", to: ["2026-02-01"], product: "x", category: "bogus", kind: "TEST" });
    expect(Object.values(parsed).filter(Boolean)).toEqual([]);
  });
});
