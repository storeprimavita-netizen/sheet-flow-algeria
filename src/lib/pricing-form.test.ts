import { describe, expect, it } from "vitest";

import { DEFAULT_PRICING_SETTINGS as PS, computeScenario } from "./pricing-v2";

import {
  anyRealImpossible,
  realBothZero,
  realDrawnProfit,
  realCellState,
  realBelow,
  realLosing,
  realZeroRate,
  realZeroRowMode,
  countOverrides,
  targetModeForKey,
  withTargetMode,
  closeFocusTarget,
  radioTabIndex,
  focusIdFor,
  rangeHint,
  rangeMessageKey,
  PRICING_FIELDS,
  nextApplied,
  type CalcApplied,
  type CalcDraft,
  breakEvenState,
  saleBelowBreakEven,
  formErrors,
  formFromOverrides,
  formFromSettings,
  overridesFromForm,
  pricingOverridesSchema,
  pricingSettingsSchema,
  productPricingInputSchema,
  sanitizeSparse,
  settingsFromForm,
  stockCostTotal,
} from "./pricing-form";
import { DEFAULT_PRICING_SETTINGS as D, computeAll, mergeSettings } from "./pricing-v2";

const blank = () => formFromOverrides({}, D);

describe("percent in -> fraction stored", () => {
  it("settings form roundtrips defaults exactly", () => {
    const f = formFromSettings(D);
    expect(f.values.platformPct).toBe(1);
    expect(f.values["confirmPct.medium"]).toBe(65);
    expect(settingsFromForm(f)).toEqual(D);
  });
  it("override: 75% share stored as 0.75, 0.75% platform as 0.0075", () => {
    const f = blank();
    f.values.share = 75;
    f.values.platformPct = 0.75;
    expect(overridesFromForm(f, D)).toEqual({ share: 0.75, platformPct: 0.0075 });
  });
});

describe("overrides diff", () => {
  it("empty -> inherit (not 0); a typed value equal to the default is pinned", () => {
    const f = blank();
    f.values.packaging = D.packaging;
    expect(overridesFromForm(f, D)).toEqual({ packaging: D.packaging });
    // an existing override equal to the new default survives editing another field
    const g = formFromOverrides({ share: D.share }, D);
    g.values.packaging = 123;
    expect(overridesFromForm(g, D)).toEqual({ share: D.share, packaging: 123 });
    expect(overridesFromForm(blank(), D)).toEqual({});
  });
  it("target value alone changed stores mode AND value together", () => {
    const f = blank();
    f.targetValue = 2000;
    expect(overridesFromForm(f, D)).toEqual({ target: { mode: "profit", value: 2000 } });
    const merged = mergeSettings(D, overridesFromForm(f, D));
    expect(merged.target).toEqual({ mode: "profit", value: 2000 });
  });
  it("markup 65 -> 0.65; mode switch without value stores value null", () => {
    const f = blank();
    f.targetMode = "markup";
    f.targetValue = 65;
    expect(overridesFromForm(f, D).target).toEqual({ mode: "markup", value: 0.65 });
    f.targetValue = null;
    expect(overridesFromForm(f, D).target).toEqual({ mode: "markup", value: null });
  });
  it("count + roundtrip", () => {
    const o = { share: 0.75, target: { mode: "markup" as const, value: 0.65 } };
    expect(countOverrides(o)).toBe(2);
    const f = formFromOverrides(o, D);
    expect(f.values.share).toBe(75);
    expect(f.targetMode).toBe("markup");
    expect(f.targetValue).toBe(65);
    expect(overridesFromForm(f, D)).toEqual(o);
  });
});

describe("validation (form units are percent)", () => {
  const errs = (patch: Record<string, number | null>) => {
    const f = formFromSettings(D);
    Object.assign(f.values, patch);
    return formErrors(f, true);
  };
  it("defaults are valid", () => expect(formErrors(formFromSettings(D), true)).toEqual({}));
  it("share 0 and 100 ok, 101 refused", () => {
    expect(errs({ share: 0 }).share).toBeUndefined();
    expect(errs({ share: 100 }).share).toBeUndefined();
    expect(errs({ share: 101 }).share).toBe("range");
  });
  it("platform 100% refused, dead 100% refused, 0 ok", () => {
    expect(errs({ platformPct: 100 }).platformPct).toBe("range");
    expect(errs({ deadPct: 100 }).deadPct).toBe("range");
    expect(errs({ platformPct: 0 }).platformPct).toBeUndefined();
  });
  it("confirm/delivery 0 and 120 refused, 100 ok", () => {
    expect(errs({ "confirmPct.best": 0 })["confirmPct.best"]).toBe("range");
    expect(errs({ "deliveryPct.worst": 120 })["deliveryPct.worst"]).toBe("range");
    expect(errs({ "confirmPct.best": 100 })["confirmPct.best"]).toBeUndefined();
  });
  it("rates > 0, fees >= 0", () => {
    expect(errs({ officialRate: 0 }).officialRate).toBe("range");
    expect(errs({ packaging: -1 }).packaging).toBe("range");
    expect(errs({ packaging: 0 }).packaging).toBeUndefined();
  });
  it("markup 1001% refused, 1000% ok; profit 1500 ok", () => {
    const f = formFromSettings(D);
    expect(formErrors(f, true).target).toBeUndefined();
    f.targetMode = "markup";
    f.targetValue = 1001;
    expect(formErrors(f, true).target).toBe("range");
    f.targetValue = 1000;
    expect(formErrors(f, true).target).toBeUndefined();
  });
  it("settings: empty is required; overrides: empty is fine", () => {
    expect(errs({ share: null }).share).toBe("required");
    expect(formErrors(blank(), false)).toEqual({});
  });
});

describe("strict schemas (fractions)", () => {
  it("accepts defaults; profit 1500 ok; markup fraction 11 refused", () => {
    expect(pricingSettingsSchema.safeParse(D).success).toBe(true);
    expect(pricingSettingsSchema.safeParse({ ...D, target: { mode: "profit", value: 1500 } }).success).toBe(true);
    expect(pricingSettingsSchema.safeParse({ ...D, target: { mode: "markup", value: 11 } }).success).toBe(false);
    expect(pricingSettingsSchema.safeParse({ ...D, share: 1.01 }).success).toBe(false);
    expect(pricingSettingsSchema.safeParse({ ...D, platformPct: 1 }).success).toBe(false);
    expect(pricingSettingsSchema.safeParse({ ...D, confirmPct: { ...D.confirmPct, best: 0 } }).success).toBe(false);
    expect(pricingSettingsSchema.safeParse({ ...D, confirmPct: { ...D.confirmPct, best: 1.2 } }).success).toBe(false);
  });
  it("overrides schema is sparse and strict", () => {
    expect(pricingOverridesSchema.safeParse({}).success).toBe(true);
    expect(pricingOverridesSchema.safeParse({ target: { mode: "markup", value: null } }).success).toBe(false);
    expect(pricingOverridesSchema.safeParse({ share: 0.5, target: { mode: "markup", value: 0.65 } }).success).toBe(true);
    expect(pricingOverridesSchema.safeParse({ target: { value: 2000 } }).success).toBe(false);
    expect(pricingOverridesSchema.safeParse({ bogus: 1 }).success).toBe(false);
    expect(pricingOverridesSchema.safeParse({ rounding: "x" }).success).toBe(false);
  });
});

describe("sanitizeSparse", () => {
  it("keeps valid keys and drops bad ones", () => {
    const r = sanitizeSparse({ packaging: 120, share: 5, confirmPct: { best: 0.9, medium: 0 }, rounding: "nope", target: { mode: "markup", value: 11 } });
    expect(r).toEqual({ packaging: 120, confirmPct: { best: 0.9 }, target: { mode: "markup", value: null } });
  });
  it("sparse workspace row with a bad key keeps the valid ones over defaults", () => {
    const merged = mergeSettings(D, sanitizeSparse({ packaging: 120, share: 7, target: { mode: "profit", value: 1500 } }));
    expect(merged.packaging).toBe(120);
    expect(merged.share).toBe(D.share);
    expect(merged.months).toBe(D.months);
    expect(merged.target).toEqual({ mode: "profit", value: 1500 });
  });
  it("non-objects -> empty", () => {
    expect(sanitizeSparse(null)).toEqual({});
    expect(sanitizeSparse([1])).toEqual({});
  });
});

describe("stock cost is per piece x quantity", () => {
  it("1,632/piece x 50 pcs -> medium total cost 3,885, price 5,500", () => {
    const total = stockCostTotal(1632, 50)!;
    expect(total).toBe(81600);
    const all = computeAll(D, { stockCostDzd: total, quantity: 50, adCostUsd: { medium: 2.2 } });
    expect(Math.round(all.medium.totalCost!)).toBe(3885);
    expect(all.medium.recommendedPrice).toBe(5500);
  });
  it("missing cost or quantity 0 -> null", () => {
    expect(stockCostTotal(0, 50)).toBeNull();
    expect(stockCostTotal(null, 50)).toBeNull();
    expect(stockCostTotal(1632, 0)).toBeNull();
  });
});

describe("productPricingInputSchema", () => {
  const ok = {
    productId: "5b0d7a2e-1c3f-4a8e-9b6d-2f4e8c1a7d30",
    overrides: {},
    adBestUsd: null,
    adMediumUsd: 2.2,
    adWorstUsd: null,
    finalPrice: null,
  };
  it("accepts a valid input", () => expect(productPricingInputSchema.safeParse(ok).success).toBe(true));
  it("rejects a non-UUID product id", () => {
    expect(productPricingInputSchema.safeParse({ ...ok, productId: "1; drop table" }).success).toBe(false);
    expect(productPricingInputSchema.safeParse({ ...ok, productId: "123" }).success).toBe(false);
  });
  it("rejects a bad final price / ad cost / override", () => {
    expect(productPricingInputSchema.safeParse({ ...ok, finalPrice: 0 }).success).toBe(false);
    expect(productPricingInputSchema.safeParse({ ...ok, adMediumUsd: -1 }).success).toBe(false);
    expect(productPricingInputSchema.safeParse({ ...ok, overrides: { share: 2 } }).success).toBe(false);
  });
});

describe("review 1 findings", () => {
  it("target mode switched away from the default with no value is an error (product form)", () => {
    const f = blank();
    f.targetMode = "markup";
    expect(formErrors(f, false, D.target.mode).target).toBe("required");
    f.targetValue = 50;
    expect(formErrors(f, false, D.target.mode).target).toBeUndefined();
    expect(formErrors(blank(), false, D.target.mode).target).toBeUndefined();
  });
  it("sub-cent final price / ad cost refused at the boundary", () => {
    const base = { productId: "11111111-1111-4111-8111-111111111111", overrides: {}, adBestUsd: null, adMediumUsd: 2.2, adWorstUsd: null, finalPrice: null };
    expect(productPricingInputSchema.safeParse({ ...base, finalPrice: 0.004 }).success).toBe(false);
    expect(productPricingInputSchema.safeParse({ ...base, adMediumUsd: 2.255 }).success).toBe(false);
    expect(productPricingInputSchema.safeParse({ ...base, adMediumUsd: 2.25, finalPrice: 4500.5 }).success).toBe(true);
  });
  it("breakEvenState: platform fee >= 100% of price is impossible, not missing", () => {
    const hi = { ...D, platformPct: 0.9, months: 0 };
    const r = computeAll(hi, { stockCostDzd: 81600, quantity: 50, adCostUsd: { medium: 2.2 }, finalPrice: 4500 }).medium;
    expect(r.k).toBeGreaterThanOrEqual(1);
    {
      expect(breakEvenState(r, "minSellingPrice")).toBe("impossible");
      expect(breakEvenState(r, "minConfirmation")).toBe("impossible");
    }
  });
});

describe("targetModeForKey (radio group arrows)", () => {
  it("LTR: right/down forward, left/up back, wraps", () => {
    expect(targetModeForKey("profit", "ArrowRight", false)).toBe("markup");
    expect(targetModeForKey("markup", "ArrowRight", false)).toBe("profit");
    expect(targetModeForKey("markup", "ArrowLeft", false)).toBe("profit");
    expect(targetModeForKey("profit", "ArrowDown", false)).toBe("markup");
  });
  it("RTL mirrors left/right", () => {
    expect(targetModeForKey("profit", "ArrowLeft", true)).toBe("markup");
    expect(targetModeForKey("markup", "ArrowRight", true)).toBe("profit");
  });
  it("other keys do nothing", () => {
    expect(targetModeForKey("profit", "Enter", false)).toBeNull();
    expect(targetModeForKey("profit", "Tab", true)).toBeNull();
  });
});

describe("saleBelowBreakEven", () => {
  it("below / equal / null sale price / null break-even", () => {
    expect(saleBelowBreakEven(3000, 3962)).toBe(true);
    expect(saleBelowBreakEven(3962, 3962)).toBe(false);
    expect(saleBelowBreakEven(null, 3962)).toBe(false);
    expect(saleBelowBreakEven(3000, null)).toBe(false);
  });
});

describe("Real column classification (review 2)", () => {
  const ok = { confirm: 0.65, delivery: 0.65 };
  it("profit -1 is below, 0 and null are not", () => {
    expect(realBelow(-1)).toBe(true);
    expect(realBelow(0)).toBe(false);
    expect(realBelow(null)).toBe(false);
  });
  it("a 0% delivery or confirmation with data is a zero rate and a loss", () => {
    expect(realZeroRate(true, { confirm: 0.65, delivery: 0 })).toBe(true);
    expect(realZeroRate(true, { confirm: 0, delivery: 0.65 })).toBe(true);
    expect(realLosing(true, { confirm: 0.65, delivery: 0 }, null)).toBe(true);
    expect(realZeroRate(false, { confirm: 0, delivery: 0 })).toBe(false);
    expect(realLosing(false, { confirm: 0, delivery: 0 }, null)).toBe(false);
    expect(realZeroRate(true, { confirm: null, delivery: 0.5 })).toBe(false);
    expect(realLosing(true, ok, 5)).toBe(false);
    expect(realLosing(true, ok, -5)).toBe(true);
  });
});

describe("realZeroRowMode (0% real delivery)", () => {
  const input = { confirm: 0.7, delivery: 0 };
  const run = computeScenario(PS, { stockCostDzd: 100000, quantity: 100 }, { confirm: 0.7, delivery: 1, adCostUsd: 2 }, 9900, 9900);
  it("final price and own break-even are read from the rate-1 run, not Not possible", () => {
    expect(realZeroRowMode(input, { key: "finalPrice" }, true)).toBe("alt");
    expect(realZeroRowMode(input, { key: "minDelivery", breakEven: "minDelivery" }, true)).toBe("alt");
    expect(run.finalPrice).toBe(9900);
    expect(run.breakEven.minDelivery).not.toBeNull();
    expect(breakEvenState(run, "minDelivery")).toBe("value");
  });
  it("other dependent rows stay impossible; inputs, no zero and missing inputs are normal", () => {
    expect(realZeroRowMode(input, { key: "minConfirmation", breakEven: "minConfirmation" }, true)).toBe("impossible");
    expect(realZeroRowMode(input, { key: "netProfit" }, true)).toBe("impossible");
    expect(realZeroRowMode(input, { key: "delivery", isInput: true }, true)).toBe("normal");
    expect(realZeroRowMode({ confirm: 0.7, delivery: 0.5 }, { key: "netProfit" }, true)).toBe("normal");
    expect(realZeroRowMode(input, { key: "netProfit" }, false)).toBe("normal");
  });
  it("mirror: confirmation 0 keeps minConfirmation and final price", () => {
    const c0 = { confirm: 0, delivery: 0.6 };
    expect(realZeroRowMode(c0, { key: "minConfirmation", breakEven: "minConfirmation" }, true)).toBe("alt");
    expect(realZeroRowMode(c0, { key: "minDelivery", breakEven: "minDelivery" }, true)).toBe("impossible");
  });
});

describe("Real column, ad cost 0 and drawn cells (PRICE-3-F)", () => {
  const settings = PS;
  const product = { stockCostDzd: 100000, quantity: 100 };
  const rows = [
    { key: "confirmation", isInput: true, get: () => null, input: (i: { confirm: number | null }) => i.confirm },
    { key: "ordersNeeded", get: (r: ReturnType<typeof computeScenario>) => r.ordersNeeded },
    { key: "finalPrice", get: (r: ReturnType<typeof computeScenario>) => r.finalPrice },
    { key: "profitPerPiece", get: (r: ReturnType<typeof computeScenario>) => r.profitPerPiece },
    { key: "minConfirmation", breakEven: "minConfirmation" as const, get: (r: ReturnType<typeof computeScenario>) => r.breakEven.minConfirmation },
    { key: "minDelivery", breakEven: "minDelivery" as const, get: (r: ReturnType<typeof computeScenario>) => r.breakEven.minDelivery },
  ];
  const build = (c: number | null, d: number | null, ad: number | null) => {
    const input = { confirm: c, delivery: d, adCostUsd: ad };
    const price = 9900;
    const result = computeScenario(settings, product, input, price, price);
    const rateOne = computeScenario(settings, product, { confirm: c === 0 ? 1 : c, delivery: d === 0 ? 1 : d, adCostUsd: ad }, price, price);
    return { result, rateOne, input, hasData: true };
  };
  const draw = (real: ReturnType<typeof build>) =>
    Object.fromEntries(
      rows.map((row) => {
        const mode = realZeroRowMode(real.input, row, real.rateOne.totalCost !== null, real.input.adCostUsd);
        const cell = realCellState(mode, real, row);
        return [row.key, `${cell.state}:${cell.srcKey}`];
      }),
    );

  it("ad 0, c 0, d 0.6: engine values, not Not possible; ordersNeeded impossible", () => {
    const real = build(0, 0.6, 0);
    expect(realZeroRowMode(real.input, rows[4], true, 0)).toBe("alt");
    expect(draw(real)).toEqual({
      confirmation: "value:result",
      ordersNeeded: "impossible:result",
      finalPrice: "value:rateOne",
      profitPerPiece: "value:rateOne",
      minConfirmation: "value:rateOne",
      minDelivery: "value:rateOne",
    });
    const other = computeScenario(settings, product, { confirm: 0.3, delivery: 0.6, adCostUsd: 0 }, 9900, 9900);
    expect(real.rateOne.profitPerPiece).toBeCloseTo(other.profitPerPiece ?? NaN, 8); // c drops out when ad = 0
    expect(realZeroRate(true, real.input, 0)).toBe(false);
    expect(realLosing(true, real.input, real.rateOne.profitPerPiece, 0)).toBe(false);
  });
  it("ad 0, c 0, d 0: minDelivery alt, the rest impossible", () => {
    const real = build(0, 0, 0);
    expect(realZeroRowMode(real.input, rows[5], true, 0)).toBe("alt");
    expect(draw(real)).toMatchObject({ profitPerPiece: "impossible:result", minConfirmation: "impossible:result", minDelivery: "value:rateOne", finalPrice: "value:rateOne" });
  });
  it("ad > 0: d 0, c 0 and both 0 draw as before", () => {
    expect(draw(build(0.7, 0, 2))).toMatchObject({ profitPerPiece: "impossible:result", minConfirmation: "impossible:result", minDelivery: "value:rateOne", finalPrice: "value:rateOne" });
    expect(draw(build(0, 0.6, 2))).toMatchObject({ profitPerPiece: "impossible:result", minConfirmation: "value:rateOne", minDelivery: "impossible:result" });
    expect(draw(build(0, 0, 2))).toMatchObject({ minConfirmation: "impossible:result", minDelivery: "impossible:result", finalPrice: "value:rateOne" });
    expect(realZeroRate(true, { confirm: 0, delivery: 0.6 }, 2)).toBe(true);
  });
  it("footer: impossible only if a drawn cell is impossible", () => {
    expect(anyRealImpossible(build(0, 0.6, 0), rows)).toBe(true); // ordersNeeded
    expect(anyRealImpossible(build(0, 0.6, 2), rows)).toBe(true);
    expect(anyRealImpossible(build(0.7, 0.6, 2), rows)).toBe(false);
    expect(anyRealImpossible({ ...build(0.7, 0.6, 2), hasData: false }, rows)).toBe(false);
  });
  it("c 0 with d null: every cell missing, no footer", () => {
    const real = build(0, null, 2);
    expect(real.rateOne.totalCost).toBeNull();
    expect(anyRealImpossible(real, rows)).toBe(false);
    expect(draw(real).minConfirmation).toMatch(/^missing/);
    expect(draw(real).profitPerPiece).toMatch(/^missing/);
  });
  it("ad 0, c 0, d 0.6, price below cost: drawn negative alt profit flags Real as losing", () => {
    const input = { confirm: 0, delivery: 0.6, adCostUsd: 0 };
    const mk = (price: number) => {
      const result = computeScenario(settings, product, input, price, price);
      const rateOne = computeScenario(settings, product, { ...input, confirm: 1 }, price, price);
      return { result, rateOne, input, hasData: true };
    };
    const real = mk(500);
    expect(real.result.profitPerPiece).toBeNull();
    const drawn = realDrawnProfit(real);
    expect(drawn).not.toBeNull();
    expect(drawn as number).toBeLessThan(0);
    expect(realLosing(true, input, drawn, 0)).toBe(true);
    expect(realDrawnProfit({ ...real, hasData: false })).toBeNull();
    expect(realLosing(true, input, realDrawnProfit(mk(9900)), 0)).toBe(false);
  });
  it("maxAdCostUsd: impossible at c 0 when ad 0 (needs c); adCostPerDeliveredUsd alt", () => {
    const more = [
      ...rows,
      { key: "maxAdCostUsd", breakEven: "maxAdCostUsd" as const, get: (r: ReturnType<typeof computeScenario>) => r.breakEven.maxAdCostUsd },
      { key: "adCostPerDeliveredUsd", get: (r: ReturnType<typeof computeScenario>) => r.adCostPerDeliveredUsd },
      { key: "totalAdUsd", get: () => null },
    ];
    const real = build(0, 0.6, 0);
    const state = (key: string) => {
      const row = more.find((r) => r.key === key)!;
      const mode = realZeroRowMode(real.input, row, true, 0);
      return `${mode}:${realCellState(mode, real, row).state}`;
    };
    expect(state("maxAdCostUsd")).toBe("impossible:impossible");
    expect(state("adCostPerDeliveredUsd")).toBe("alt:value");
    expect(state("totalAdUsd")).toBe("impossible:impossible");
    expect(anyRealImpossible(real, more)).toBe(true);
  });
  it("realBothZero truth table", () => {
    expect(realBothZero(true, { confirm: 0, delivery: 0 }, 2)).toBe(true);
    expect(realBothZero(true, { confirm: 0, delivery: 0 }, null)).toBe(true);
    expect(realBothZero(true, { confirm: 0, delivery: 0 }, 0)).toBe(false);
    expect(realBothZero(true, { confirm: 0, delivery: 0.5 }, 2)).toBe(false);
    expect(realBothZero(false, { confirm: 0, delivery: 0 }, 2)).toBe(false);
  });
  it("NaN stock cost: rate-one totalCost null, cell missing", () => {
    const run = computeScenario(settings, { stockCostDzd: Number.NaN, quantity: 100 }, { confirm: 1, delivery: 1, adCostUsd: 2 }, 9900, 9900);
    expect(run.totalCost).toBeNull();
    expect(realZeroRowMode({ confirm: 0.7, delivery: 0 }, rows[3], false, 2)).toBe("normal");
    expect(breakEvenState(run, "minDelivery")).toBe("missing");
  });
  it("engine: d 0 keeps finalPrice; minDelivery same at d 1 and 0.0001, same for c", () => {
    const at = (c: number, d: number) => computeScenario(settings, product, { confirm: c, delivery: d, adCostUsd: 2 }, 9900, 9900);
    expect(at(0.7, 0).finalPrice).not.toBeNull();
    expect(at(0.7, 1).breakEven.minDelivery).toBeCloseTo(at(0.7, 0.0001).breakEven.minDelivery ?? NaN, 10);
    expect(at(1, 0.6).breakEven.minConfirmation).toBeCloseTo(at(0.0001, 0.6).breakEven.minConfirmation ?? NaN, 10);
  });
});

describe("focus helpers", () => {
  const form = { ...formFromSettings(PS), targetMode: "profit" as const, targetValue: 500 };
  it("withTargetMode clears value on mode change", () => {
    const next = withTargetMode(form, "markup");
    expect(next.targetMode).toBe("markup");
    expect(next.targetValue).toBeNull();
    expect(next.values).toBe(form.values);
  });
  it("withTargetMode same mode keeps form", () => {
    expect(withTargetMode(form, "profit")).toBe(form);
  });
  it("closeFocusTarget escape/cancel -> button", () => {
    expect(closeFocusTarget({ didReset: false, btnDisabled: false })).toBe("button");
  });
  it("closeFocusTarget after reset or disabled -> firstField", () => {
    expect(closeFocusTarget({ didReset: true, btnDisabled: false })).toBe("firstField");
    expect(closeFocusTarget({ didReset: false, btnDisabled: true })).toBe("firstField");
  });
  it("radioTabIndex roving", () => {
    expect(radioTabIndex(true)).toBe(0);
    expect(radioTabIndex(false)).toBe(-1);
  });
  it("focusIdFor dotted key", () => {
    expect(focusIdFor("pd", "adMultiplier.best")).toBe("pd-adMultiplier.best");
    expect(focusIdFor("pd", "target")).toBe("pd-target");
  });
});

describe("calculator", () => {
  const draft: CalcDraft = { quantity: 100, form: formFromOverrides({}, PS), adBest: null, adMedium: 5, adWorst: null, finalPrice: 4000 };
  const first: CalcApplied = nextApplied({ quantity: 100, overrides: {}, ads: { best: null, medium: null, worst: null }, finalPrice: null }, draft, PS);
  it("calculator: invalid quantity keeps overrides applied", () => {
    const form = { ...draft.form, values: { ...draft.form.values, packaging: 77 } };
    const next = nextApplied(first, { ...draft, quantity: null, form, finalPrice: 4500 }, PS);
    expect(next.quantity).toBe(100);
    expect(next.finalPrice).toBe(4500);
    expect(next.overrides.packaging).toBe(77);
  });
  it("calculator: invalid override or price freezes the table", () => {
    const bad = { ...draft.form, values: { ...draft.form.values, packaging: -1 } };
    expect(nextApplied(first, { ...draft, form: bad }, PS)).toBe(first);
    expect(nextApplied(first, { ...draft, finalPrice: -5 }, PS)).toBe(first);
  });
  it("calculator: unchanged draft keeps identity; valid quantity applies", () => {
    expect(nextApplied(first, draft, PS)).toBe(first);
    expect(nextApplied(first, { ...draft, quantity: 50 }, PS).quantity).toBe(50);
  });
});

describe("range messages", () => {
  const def = (k: string) => PRICING_FIELDS.find((f) => f.key === k)!;
  it("range hint shows display units", () => {
    expect(rangeHint(def("confirmPct.best"))).toEqual({ kind: "gtUp", min: 0, max: 100 });
    expect(rangeHint(def("platformPct"))).toEqual({ kind: "geLt", min: 0, max: 100 });
    expect(rangeHint(def("officialRate"))).toEqual({ kind: "gt", min: 0 });
    expect(rangeHint(def("packaging"))).toEqual({ kind: "ge", min: 0 });
  });
  it("NaN reads as not a number", () => {
    expect(rangeMessageKey(Number.NaN)).toBe("notNumber");
    expect(rangeMessageKey(5)).toBe("range");
  });
});
