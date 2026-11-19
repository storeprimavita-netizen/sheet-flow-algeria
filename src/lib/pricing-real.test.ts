import { describe, expect, it } from "vitest";

import type { Kpi } from "./kpi";
import { realScenarioInput } from "./pricing-real";
import { DEFAULT_PRICING_SETTINGS as S, computeAll, computeScenario } from "./pricing-v2";

const metric = (value: number | null, matured = true) => ({ num: 0, den: 0, value, matured });
const kpi = (over: Partial<Kpi> = {}): Kpi =>
  ({
    confirmation: { ...metric(0.7), of_received: 0.5 },
    delivery: metric(0.6),
    return: metric(0.4),
    delivered_of_confirmed: metric(0.3),
    counts: { received: 100, confirmed: 65, delivered: 42, returned: 0, swapped: 0, in_flight: 0, on_road_orders: 0, on_road_units: 0 },
    usd_rate: null,
    ad_spend_dzd: 100 * 2.2 * S.parallelRate,
    ...over,
  }) as Kpi;

describe("realScenarioInput", () => {
  it("maps kpi to fractions", () => {
    const r = realScenarioInput(kpi(), S.parallelRate);
    expect(r.input.confirm).toBe(0.7);
    expect(r.input.delivery).toBe(0.6);
    expect(r.hasData).toBe(true);
  });
  it("null kpi -> hasData false", () => {
    const r = realScenarioInput(null, S.parallelRate);
    expect(r.hasData).toBe(false);
    expect(r.matured).toBe(false);
    expect(r.input).toEqual({ confirm: null, delivery: null, adCostUsd: null });
  });
  it("zero received -> adCostUsd null", () => {
    const k = kpi();
    k.counts.received = 0;
    expect(realScenarioInput(k, S.parallelRate).input.adCostUsd).toBeNull();
  });
  it("ad cost uses parallelRate", () => {
    expect(realScenarioInput(kpi({ ad_spend_dzd: 25000 }), 250).input.adCostUsd).toBeCloseTo(1, 10);
    expect(realScenarioInput(kpi(), null).input.adCostUsd).toBeNull();
  });
  it("not-matured flag from either metric", () => {
    expect(realScenarioInput(kpi(), 250).matured).toBe(true);
    expect(realScenarioInput(kpi({ confirmation: metric(0.7, false) }), 250).matured).toBe(false);
    expect(realScenarioInput(kpi({ delivery: metric(0.6, false) }), 250).matured).toBe(false);
  });
  it("review-1 in-flight case: 60 delivered, 15 returned, 25 on the road -> 0.80, not matured", () => {
    const r = realScenarioInput(kpi({ delivery: { num: 60, den: 75, value: 0.8, matured: false } }), 250);
    expect(r.input.delivery).toBe(0.8);
    expect(r.matured).toBe(false);
  });
  it("null rates with orders received stay null (shown as a dash, never 0)", () => {
    const a = realScenarioInput(kpi({ confirmation: metric(null) }), 250);
    expect(a.input.confirm).toBeNull();
    expect(a.hasData).toBe(true);
    const b = realScenarioInput(kpi({ delivery: metric(null) }), 250);
    expect(b.input.delivery).toBeNull();
    expect(b.hasData).toBe(true);
  });
  it("missing ad_spend_dzd -> ad cost null, rates still read", () => {
    const k = kpi();
    delete k.ad_spend_dzd;
    const r = realScenarioInput(k, 250);
    expect(r.input.adCostUsd).toBeNull();
    expect(r.adCostDzd).toBeNull();
    expect(r.input.confirm).toBe(0.7);
  });
  it("adCostDzd is real DZD spend per received order", () => {
    expect(realScenarioInput(kpi({ ad_spend_dzd: 25000 }), 250).adCostDzd).toBe(250);
  });
  it("benz inputs reproduce the MEDIUM column", () => {
    const product = { stockCostDzd: 81600, quantity: 50 };
    const medium = computeAll(S, { ...product, adCostUsd: { medium: 2.2 } }).medium;
    const real = computeScenario(S, product, realScenarioInput(kpi({ confirmation: metric(0.65), delivery: metric(0.65) }), S.parallelRate).input, null, medium.recommendedPrice);
    expect(Math.round(real.totalCost ?? 0)).toBe(3885);
    expect(real.totalCost).toBeCloseTo(medium.totalCost ?? 0, 6);
  });
  it("keeps adCostDzd when the parallel rate is invalid", () => {
    const r = realScenarioInput(kpi({ ad_spend_dzd: 22000 }), 0);
    expect(r.input.adCostUsd).toBeNull();
    expect(r.adCostDzd).toBe(220);
  });
  it("a real 0% delivery maps to 0, not null", () => {
    const r = realScenarioInput(kpi({ delivery: metric(0) }), S.parallelRate);
    expect(r.input.delivery).toBe(0);
  });
});
