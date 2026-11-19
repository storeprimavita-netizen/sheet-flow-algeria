import { describe, expect, it } from "vitest";

import type { Kpi } from "./kpi";
import { realScenarioInput } from "./pricing-real";
import { DEFAULT_PRICING_SETTINGS as S, computeAll, computeScenario } from "./pricing-v2";

const metric = (value: number | null, matured = true) => ({ num: 0, den: 0, value, matured });
const kpi = (over: Partial<Kpi> = {}): Kpi =>
  ({
    confirmation: { ...metric(0.7), of_received: 0.65 },
    delivery: metric(0.6),
    return: metric(0.4),
    delivered_of_confirmed: metric(0.65),
    counts: { received: 100, confirmed: 65, delivered: 42, returned: 0, swapped: 0, in_flight: 0, on_road_orders: 0, on_road_units: 0 },
    usd_rate: null,
    ad_spend_dzd: 100 * 2.2 * S.parallelRate,
    ...over,
  }) as Kpi;

describe("realScenarioInput", () => {
  it("maps kpi to fractions", () => {
    const r = realScenarioInput(kpi(), S.parallelRate);
    expect(r.input.confirm).toBe(0.65);
    expect(r.input.delivery).toBe(0.65);
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
    expect(realScenarioInput(kpi({ confirmation: { ...metric(0.7, false), of_received: 0.65 } }), 250).matured).toBe(false);
    expect(realScenarioInput(kpi({ delivered_of_confirmed: metric(0.65, false) }), 250).matured).toBe(false);
  });
  it("benz inputs reproduce the MEDIUM column", () => {
    const product = { stockCostDzd: 81600, quantity: 50 };
    const medium = computeAll(S, { ...product, adCostUsd: { medium: 2.2 } }).medium;
    const real = computeScenario(S, product, realScenarioInput(kpi(), S.parallelRate).input, null, medium.recommendedPrice);
    expect(Math.round(real.totalCost ?? 0)).toBe(3885);
    expect(real.totalCost).toBeCloseTo(medium.totalCost ?? 0, 6);
  });
});
