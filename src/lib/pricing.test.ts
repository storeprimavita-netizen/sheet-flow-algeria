import { describe, expect, it } from "vitest";

import {
  DEFAULT_INPUTS,
  breakEvenDeliveryPct,
  computeScenario,
  normalizeInputs,
  pnlMetrics,
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

describe("pnlMetrics (actuals, 15b)", () => {
  // 10 received, 8 confirmed, 5 delivered @ 4000, 3 returned @ 150,
  // unit cost 1500, ad spend 6000, expenses 1000, fixed 2000.
  const lines = {
    period_from: "2026-10-01", period_to: "2026-10-30", days: 30,
    orders_received: 10, orders_confirmed: 8, orders_delivered: 5, orders_returned: 3, orders_cancelled: 2,
    revenue: 20000, cogs: 7500, return_fee_unit: 150, return_fees: 450,
    ad_spend_test: 4000, ad_spend_scaling: 2000, ad_spend: 6000, expenses: 1000, fixed_fees_monthly: 2000, fixed_share: 1, fixed_fees: 2000,
    net_profit: 20000 - 7500 - 450 - 6000 - 1000 - 2000, // 3050
    cash_to_collect: 8000,
  };

  it("derives margin, aov and total costs from the lines", () => {
    const m = pnlMetrics(lines);
    expect(m.total_costs).toBe(16950);
    expect(m.margin_pct).toBe(15.3);
    expect(m.aov).toBe(4000);
  });

  it("break-even delivery rate zeroes net profit at that rate", () => {
    const m = pnlMetrics(lines);
    // (9000 + 8·150) / (8·(4000 − 1500 + 150)) = 10200 / 21200 = 48.1%
    expect(m.breakeven_delivery_pct).toBe(48.1);
    const d = 10200 / 21200;
    const net = 8 * d * (4000 - 1500) - 8 * (1 - d) * 150 - 9000;
    expect(Math.abs(net)).toBeLessThan(1e-6);
  });

  it("is null-safe with no activity", () => {
    const m = pnlMetrics({ ...lines, orders_received: 0, orders_confirmed: 0, orders_delivered: 0, orders_returned: 0, revenue: 0, cogs: 0, ad_spend: 0, net_profit: -3000 });
    expect(m.margin_pct).toBeNull();
    expect(m.aov).toBeNull();
    expect(m.breakeven_delivery_pct).toBeNull();
  });
});
