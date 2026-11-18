import { describe, expect, it } from "vitest";

import {
  countOverrides,
  targetModeForKey,
  breakEvenState,
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
