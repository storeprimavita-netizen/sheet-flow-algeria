import { describe, expect, it } from "vitest";

import {
  DEFAULT_INPUTS,
  breakEvenDeliveryPct,
  computeScenario,
  normalizeInputs,
  type PricingInputs,
} from "./pricing";

// Exact inputs from "BENZ Pricing (31).xlsx" MEDIUM SCENARIO block, extracted
// straight from the sheet's cell values (not re-derived from the expected
// output) so this pins computeScenario() against the real spreadsheet.
const MEDIUM_INPUTS: PricingInputs = {
  product_price: 3000,
  euro_price: 290,
  lead_cost_eur: 2.4,
  confirmation_pct: 70,
  delivery_pct: 60,
  delivery_price: 400,
  confirmation_agent: 0,
  packaging_fees: 30,
  sale_price: 5400,
  spend_eur_day: 100,
  delivery_fee_da: 130,
  flexy_month: 2500,
  location_day: 2000,
  salary_month: 290000,
};

describe("computeScenario", () => {
  it("matches the sheet's BEST scenario", () => {
    const r = computeScenario(DEFAULT_INPUTS);
    expect(r.net_profit_per_order).toBeCloseTo(1025.94, 2);
    expect(r.net_profit_per_month).toBeCloseTo(130037.5, 1);
  });

  it("matches the sheet's MEDIUM scenario", () => {
    const r = computeScenario(MEDIUM_INPUTS);
    expect(r.net_profit_per_order).toBeCloseTo(-445.2, 1);
    expect(r.net_profit_per_month).toBeCloseTo(-233750, 0);
  });

  it("returns all zeros, never NaN/Infinity, for all-zero inputs", () => {
    const r = computeScenario({});
    for (const value of Object.values(r)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBe(0);
    }
  });
});

describe("breakEvenDeliveryPct", () => {
  it("returns the rate where net profit crosses zero, and profit holds above it", () => {
    const be = breakEvenDeliveryPct(MEDIUM_INPUTS);
    expect(be).not.toBeNull();
    // profitable at the reported rate, unprofitable just below it
    expect(computeScenario({ ...MEDIUM_INPUTS, delivery_pct: be! }).net_profit_per_order).toBeGreaterThanOrEqual(0);
    expect(computeScenario({ ...MEDIUM_INPUTS, delivery_pct: be! - 0.5 }).net_profit_per_order).toBeLessThan(0);
  });

  it("returns a low rate when the inputs are already very profitable", () => {
    // BEST breaks even far below its 65% delivery assumption
    expect(breakEvenDeliveryPct(DEFAULT_INPUTS)!).toBeLessThan(DEFAULT_INPUTS.delivery_pct);
  });

  it("returns null when a sale below cost can never break even", () => {
    expect(breakEvenDeliveryPct({ ...DEFAULT_INPUTS, sale_price: 1 })).toBeNull();
  });
});

describe("normalizeInputs", () => {
  it("fills missing keys from DEFAULT_INPUTS", () => {
    expect(normalizeInputs({})).toEqual(DEFAULT_INPUTS);
    expect(normalizeInputs(undefined)).toEqual(DEFAULT_INPUTS);
    expect(normalizeInputs(null)).toEqual(DEFAULT_INPUTS);
  });

  it("coerces numeric strings", () => {
    const out = normalizeInputs({ product_price: "1234.5" });
    expect(out.product_price).toBe(1234.5);
  });

  it("falls back to the default for non-numeric junk", () => {
    const out = normalizeInputs({ product_price: "not a number", euro_price: undefined });
    expect(out.product_price).toBe(DEFAULT_INPUTS.product_price);
    expect(out.euro_price).toBe(DEFAULT_INPUTS.euro_price);
  });
});
