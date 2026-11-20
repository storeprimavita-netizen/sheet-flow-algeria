import { describe, expect, it } from "vitest";

import { pnlMetrics } from "./pricing";

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
