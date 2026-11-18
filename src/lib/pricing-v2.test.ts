import { describe, expect, it } from "vitest";

import {
  DEFAULT_PRICING_SETTINGS as S,
  NATIVE_PLATFORM_PRESET,
  applyRounding,
  computeAll,
  computeScenario,
  mergeSettings,
  resolveAdCosts,
  type PricingProduct,
  type ScenarioName,
  type PricingSettings,
} from "./pricing-v2";

const benz: PricingProduct = {
  stockCostDzd: 81600,
  quantity: 50,
  adCostUsd: { best: 1.5, medium: 2.2, worst: 2.7 },
  finalPrice: 4500,
};
const r2 = (x: number | null) => (x === null ? null : Math.round(x * 100) / 100);
const r0 = (x: number | null) => (x === null ? null : Math.round(x));
const pct1 = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 10);
const mid = (p: PricingProduct = benz, s: PricingSettings = S) => computeAll(s, p).medium;
const medIn = { confirm: 0.65, delivery: 0.65, adCostUsd: 2.2 };

describe("benz pinned table", () => {
  const all = computeAll(S, benz);
  const cases = [
    ["best", 100.39, 25599, 3063, 4700, 1350, 60769, 24.3, 30.8, 5.06, 3123],
    ["medium", 234.32, 59751, 3885, 5500, 528, 23745, 46.5, 49.1, 3.07, 3962],
    ["worst", 361.18, 92100, 4641, 6300, -228, -10274, 65.3, 64.1, 2.4, 4733],
  ] as Array<[ScenarioName, ...number[]]>;
  it.each(cases)("%s", (name, ...v) => {
    const [adUsd, adDzd, tc, rec, ppp, np, minC, minD, maxAd, minP] = v;
    const r = all[name];
    expect(r2(r.totalAdUsd)).toBe(adUsd);
    expect(r0(r.totalAdDzd)).toBe(adDzd);
    expect(r0(r.totalCost)).toBe(tc);
    expect(r.recommendedPrice).toBe(rec);
    expect(r0(r.profitPerPiece)).toBe(ppp);
    expect(r0(r.netProfit)).toBe(np);
    expect(pct1(r.breakEven.minConfirmation)).toBe(minC);
    expect(pct1(r.breakEven.minDelivery)).toBe(minD);
    expect(r2(r.breakEven.maxAdCostUsd)).toBe(maxAd);
    expect(r0(r.breakEven.minSellingPrice)).toBe(minP);
  });
  it("k and medium total cost", () => {
    expect(Math.round((all.medium.k ?? 0) * 1e6) / 1e6).toBe(0.019318);
    expect(r2(all.medium.totalCost)).toBe(3885.39);
    expect(r2(all.medium.profitPerPiece)).toBe(527.68);
  });
});

describe("medium details", () => {
  const m = mid();
  it("cost lines pinned individually", () => {
    expect(r2(m.lines.product)).toBe(1813.33);
    expect(r2(m.lines.ads)).toBe(1327.81);
    expect(r2(m.lines.returns)).toBe(107.69);
    expect(r2(m.lines.otherStock)).toBe(222.22);
    expect(r2(m.lines.platformMonthly)).toBe(164.33);
    expect([m.lines.confirmation, m.lines.packaging, m.lines.otherPerOrder]).toEqual([150, 90, 10]);
  });
  it("unrounded k and exact price", () => {
    expect(Math.round((m.k ?? 0) * 1e7) / 1e7).toBe(0.0193182);
    expect(r2(m.exactPrice)).toBe(5491.48);
  });
  it("default final price uses medium recommended", () => {
    const all = computeAll(S, { ...benz, finalPrice: undefined });
    expect(all.best.finalPrice).toBe(5500);
    expect([all.best, all.medium, all.worst].map((r) => r2(r.profitPerPiece))).toEqual([2331.1, 1508.36, 752.36]);
    expect([all.best, all.medium, all.worst].map((r) => Math.round((r.netProfit ?? 0) * 10) / 10)).toEqual([
      104899.5, 67876.1, 33856.3,
    ]);
  });
  it("final price 0 vs empty", () => {
    for (const f of [0, null, undefined, -100, NaN]) {
      expect(computeAll(S, { ...benz, finalPrice: f }).medium.finalPrice).toBe(5500);
    }
  });
});

describe("rounding", () => {
  it("up100 by default, with float noise", () => {
    expect(applyRounding(5491.48, "up100")).toBe(5500);
    expect(applyRounding(300.00000000000006, "up100")).toBe(300);
    expect(applyRounding(300.01, "up100")).toBe(400);
  });
  it("charm 900 / 990 / 99 endings", () => {
    expect(applyRounding(5491.48, "charm900")).toBe(5900);
    expect(applyRounding(5950, "charm900")).toBe(6900);
    expect(applyRounding(5491.48, "charm990")).toBe(5990);
    expect(applyRounding(5491.48, "charm99")).toBe(5499);
    expect(applyRounding(5499.5, "charm99")).toBe(5599);
  });
  it("nearest rounding can undercut target", () => {
    expect(applyRounding(5420, "nearest100")).toBe(5400);
    expect(applyRounding(5424, "nearest50")).toBe(5400);
    expect(applyRounding(NaN, "up100")).toBeNull();
  });
});

describe("markup mode (D51)", () => {
  it("derives target from product cost", () => {
    const s = { ...S, target: { mode: "markup" as const, value: 0.65 } };
    const all = computeAll(s, benz);
    expect(r2(all.medium.targetProfit)).toBe(1178.67);
    expect(r2(all.medium.exactPrice)).toBe(5163.81);
    expect(all.medium.recommendedPrice).toBe(5200);
    expect(all.best.recommendedPrice).toBe(4400);
    expect(all.worst.recommendedPrice).toBe(6000);
  });
});

describe("native preset", () => {
  it("removes platform lines", () => {
    const m = mid(benz, { ...S, ...NATIVE_PLATFORM_PRESET });
    expect(m.k).toBe(0);
    expect(m.lines.platformMonthly).toBe(0);
    expect(m.platformFee).toBe(0);
  });
});

describe("null not NaN", () => {
  const bad = (v: unknown): boolean =>
    typeof v === "number"
      ? !Number.isFinite(v)
      : v !== null && typeof v === "object"
        ? Object.values(v).some(bad)
        : false;
  const all = (r: ReturnType<typeof computeScenario>) => bad(r);
  it.each([
    ["quantity 0", S, { ...benz, quantity: 0 }, medIn],
    ["100% dead stock", { ...S, deadPct: 1 }, benz, medIn],
    ["O = 0", { ...S, officialRate: 0 }, benz, medIn],
    ["B = 0", { ...S, parallelRate: 0 }, benz, medIn],
    ["c = 0", S, benz, { ...medIn, confirm: 0 }],
    ["d = 0", S, benz, { ...medIn, delivery: 0 }],
    ["NaN input", S, { ...benz, stockCostDzd: NaN }, medIn],
    ["NaN ad cost", S, benz, { ...medIn, adCostUsd: NaN }],
  ])("%s", (_n, s, p, input) => {
    const r = computeScenario(s as PricingSettings, p, input, 4500);
    expect(r.totalCost).toBeNull();
    expect(r.recommendedPrice).toBeNull();
    expect(r.profitPerPiece).toBeNull();
    expect(r.netProfit).toBeNull();
    expect(all(r)).toBe(false);
  });
  it("k >= 1 gives null prices", () => {
    const r = computeScenario({ ...S, platformPct: 1 }, benz, medIn, 4500);
    expect(r.k).toBeGreaterThanOrEqual(1);
    expect(r.exactPrice).toBeNull();
    expect(r.recommendedPrice).toBeNull();
    expect(r.breakEven.minSellingPrice).toBeNull();
  });
  it("P = 0 gives null margin", () => {
    const r = computeScenario(S, benz, medIn, 0, 0);
    expect(r.margin).toBeNull();
    expect(bad(r)).toBe(false);
  });
  it("null medium recommended keeps best/worst P null", () => {
    const all = computeAll(S, { ...benz, finalPrice: undefined, overrides: { confirmPct: { medium: 0 } } });
    expect(all.medium.recommendedPrice).toBeNull();
    for (const n of ["best", "worst"] as const) {
      expect(all[n].finalPrice).toBeNull();
      expect(all[n].profitPerPiece).toBeNull();
    }
  });
  it("null / NaN medium ad cost is null, not 0", () => {
    const r = resolveAdCosts(null);
    expect(r).toEqual({ best: null, medium: null, worst: null });
    expect(resolveAdCosts(NaN).worst).toBeNull();
    expect(resolveAdCosts(null, S, { best: 0 }).best).toBe(0);
    const all = computeAll(S, { ...benz, adCostUsd: { medium: null as unknown as number } });
    expect(all.best.totalCost).toBeNull();
  });
  it("invalid rounding / mode strings are ignored; bad percentages give null", () => {
    expect(mergeSettings(S, { rounding: "bogus" as never, target: { mode: "foo" as never } })).toEqual(S);
    expect(applyRounding(100, "bogus" as never)).toBeNull();
    expect(computeScenario(S, benz, { ...medIn, confirm: -0.5 }, 4500).totalCost).toBeNull();
    expect(computeScenario(S, benz, { ...medIn, delivery: 1.5 }, 4500).totalCost).toBeNull();
    expect(computeScenario({ ...S, deadPct: -0.5 }, benz, medIn, 4500).totalCost).toBeNull();
  });
  it("markup mode without product cost gives null target", () => {
    const s = { ...S, target: { mode: "markup" as const, value: 0.65 } };
    expect(computeScenario(s, { stockCostDzd: NaN, quantity: 50 }, medIn).targetProfit).toBeNull();
  });
  it("k exactly 1 gives null recommended price", () => {
    expect(computeScenario({ ...S, platformPct: 132 / 255 }, benz, medIn).recommendedPrice).toBeNull();
  });
  it("charm price already on the ending stays", () => {
    expect(applyRounding(5900, "charm900")).toBe(5900);
  });
  it("sparse workspace settings fall back to defaults; breakEven not shared", () => {
    expect(computeAll({ packaging: 90 }, benz).medium.recommendedPrice).toBe(5500);
    const a = computeScenario({ ...S, officialRate: 0 }, benz, medIn);
    a.breakEven.minDelivery = 1;
    expect(computeScenario({ ...S, officialRate: 0 }, benz, medIn).breakEven.minDelivery).toBeNull();
  });
  it("native preset recommended price", () => {
    expect(mid(benz, { ...S, ...NATIVE_PLATFORM_PRESET }).recommendedPrice).toBe(5300);
  });
});

describe("break-even", () => {
  it("null when denominator <= 0 or result > 100%", () => {
    const low = computeScenario(S, benz, medIn, 2500).breakEven; // NP below non-ad costs
    expect(low.minConfirmation).toBeNull();
    expect(low.maxAdCostUsd).toBeNull();
    const tight = computeScenario(S, benz, { confirm: 0.65, delivery: 0.65, adCostUsd: 2.2 }, 3000).breakEven;
    expect(tight.minDelivery).toBeNull(); // would exceed 100%
    expect(tight.minConfirmation).toBeNull();
  });
});

describe("ad costs", () => {
  it("typed best/worst override multiplier", () => {
    const r = resolveAdCosts(2.2, S, { best: 1.5, worst: 2.7 });
    expect([r.best, r.worst]).toEqual([1.5, 2.7]);
  });
  it("resolveAdCosts(2.2) -> 1.50 / 2.71", () => {
    const r = resolveAdCosts(2.2);
    expect([r.best, r.medium, r.worst]).toEqual([1.5, 2.2, 2.71]);
  });
});

describe("overrides", () => {
  it("per-product override beats workspace setting", () => {
    const m = mid({ ...benz, overrides: { packaging: 190 } });
    expect(m.lines.packaging).toBe(190);
    expect(r2(m.totalCost)).toBe(3985.39);
  });
  it("nested partial override leaves other scenarios unchanged", () => {
    const base = computeAll(S, benz);
    const over = computeAll(S, { ...benz, overrides: { confirmPct: { medium: 0.7 } } });
    expect(over.best).toEqual(base.best);
    expect(over.worst).toEqual(base.worst);
    expect(over.medium.totalCost).not.toEqual(base.medium.totalCost);
  });
  it("null override value ignored", () => {
    const merged = mergeSettings(S, { packaging: null, confirmPct: null, target: { value: null } });
    expect(merged).toEqual(S);
    expect(mergeSettings(S, { platformPct: NaN })).toEqual(S);
    expect(mergeSettings(S, undefined)).toEqual(S);
  });
});

describe("review 3 fixes", () => {
  it("target merges as one unit (mode change without value -> null price)", () => {
    const m = mid({ ...benz, finalPrice: null, overrides: { target: { mode: "markup", value: null } } });
    expect(m.targetProfit).toBeNull();
    expect(m.recommendedPrice).toBeNull();
    const ws = { target: { mode: "markup" as const, value: 0.65 } };
    const r = computeAll(ws, { ...benz, finalPrice: null, overrides: { target: { mode: "profit" } } }).medium;
    expect(r.recommendedPrice).toBeNull();
    expect(mergeSettings(S, { target: { value: 2000 } }).target).toEqual({ mode: "profit", value: 2000 });
  });
  it("out-of-range settings give null", () => {
    expect(mid(benz, { ...S, share: 50 }).recommendedPrice).toBeNull();
    expect(mid(benz, { ...S, months: -2 }).recommendedPrice).toBeNull();
    expect(mid(benz, { ...S, platformPct: -0.5 }).recommendedPrice).toBeNull();
    expect(mid({ ...benz, adCostUsd: { medium: -1 } }).recommendedPrice).toBeNull();
    expect(mid(benz, { ...S, adMultiplier: { best: -1, worst: 1.23 } }).recommendedPrice).toBe(5500);
    expect(mid(benz, { ...S, target: { mode: "profit", value: -5000 } }).recommendedPrice).toBeNull();
    expect(mid(benz, { ...S, target: { mode: "markup", value: 65 } }).recommendedPrice).not.toBeNull();
  });
  it("up100 with non-positive exact price is null, never -0", () => {
    expect(applyRounding(-0.5, "up100")).toBe(-0);
  });
  it("worst finalPrice falls back to medium recommended when empty", () => {
    expect(computeAll(S, { ...benz, finalPrice: null }).worst.finalPrice).toBe(5500);
  });
  it("minDelivery null when denominator <= 0", () => {
    const r = computeScenario(S, benz, { ...medIn, confirm: 0.65, delivery: 0.65 }, 100);
    expect(r.breakEven.minDelivery).toBeNull();
  });
});
