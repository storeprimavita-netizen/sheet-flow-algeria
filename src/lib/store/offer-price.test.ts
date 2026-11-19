import { describe, expect, test } from "vitest";

import { comparePrice, lowestPrice, piecesCharge, offerCharge, offerSaving, unitPrice, visibleOffers, type SizePriceInput } from "./offer-price";
import { sizeInStock } from "./variant-stock";

const base: SizePriceInput = { mode: "uniform", basePrice: 5000, compareAt: null, valueDeltas: [], override: null, compareOverride: null };

describe("unitPrice", () => {
  test("uniform price all sizes", () => {
    expect(unitPrice({ ...base, valueDeltas: [300], override: 9999 })).toBe(5000);
  });
  test("per_value adds delta", () => {
    expect(unitPrice({ ...base, mode: "per_value", valueDeltas: [300, -100] })).toBe(5200);
  });
  test("per_variant override wins", () => {
    expect(unitPrice({ ...base, mode: "per_variant", override: 4200 })).toBe(4200);
    expect(unitPrice({ ...base, mode: "per_variant", override: null })).toBe(5000);
  });
  test("negative delta makes size unsellable (refused, not clamped)", () => {
    expect(unitPrice({ ...base, mode: "per_value", valueDeltas: [-5000] })).toBeNull();
    expect(unitPrice({ ...base, mode: "per_value", valueDeltas: [-9000] })).toBeNull();
    expect(unitPrice({ ...base, mode: "per_variant", override: 0 })).toBeNull();
  });
  test("never NaN, always integer", () => {
    expect(unitPrice({ ...base, basePrice: Number.NaN })).toBeNull();
    expect(unitPrice({ ...base, mode: "per_value", valueDeltas: [Number.NaN] })).toBeNull();
    expect(unitPrice({ ...base, basePrice: 4999.6 })).toBe(5000);
  });
});

describe("comparePrice", () => {
  test("compare below price hidden (all modes)", () => {
    for (const mode of ["uniform", "per_value", "per_variant"] as const) {
      const i = { ...base, mode, compareAt: 4000, compareOverride: 4000 };
      expect(comparePrice(i, unitPrice(i))).toBeNull();
      expect(comparePrice({ ...i, compareAt: 5000, compareOverride: 5000 }, 5000)).toBeNull();
    }
  });
  test("shown when higher; override wins in per_variant", () => {
    expect(comparePrice({ ...base, compareAt: 7000 }, 5000)).toBe(7000);
    expect(comparePrice({ ...base, mode: "per_variant", compareAt: 7000, compareOverride: 8000 }, 5000)).toBe(8000);
    expect(comparePrice({ ...base, compareAt: 7000 }, null)).toBeNull();
    // per_variant size with its own price and no own compare: the product compare must not appear
    const sz = { ...base, mode: "per_variant" as const, compareAt: 6000, override: 3000, compareOverride: null };
    expect(comparePrice(sz, unitPrice(sz))).toBeNull();
    // per_value: the size's delta moves the crossed-out price too (sale 5000, compare 6000, S -1000 -> 4000 vs 5000)
    const s = { ...base, mode: "per_value" as const, compareAt: 6000, valueDeltas: [-1000] };
    expect(comparePrice(sz, unitPrice(sz))).toBe(5000);
  });
});

describe("offers", () => {
  const o = { id: "a", label: "x2", qty: 2, total: 9000 };
  test("offer capped at qty*unit", () => {
    expect(offerCharge(5000, o)).toBe(9000);
    expect(offerCharge(4000, o)).toBe(8000);
    expect(offerSaving(5000, o)).toBe(1000);
    expect(offerSaving(4000, o)).toBe(0);
  });
  test("offers that save nothing are hidden; invalid ones too", () => {
    expect(visibleOffers(4000, [o])).toEqual([]);
    expect(visibleOffers(5000, [o, { ...o, id: "b", qty: 1 }, { ...o, id: "c", total: Number.NaN }])).toEqual([o]);
  });
  test("lowestPrice skips unsellable sizes", () => {
    expect(lowestPrice([null, 5200, 4800])).toBe(4800);
    expect(lowestPrice([null])).toBeNull();
  });
});

describe("piecesCharge (mixed sizes)", () => {
  const o = { qty: 2, total: 9000 };
  test("pays the offer total, capped at the pieces one by one", () => {
    expect(piecesCharge([5000, 5000], o)).toEqual({ subtotal: 10000, charge: 9000, saving: 1000 });
    expect(piecesCharge([5000, 4000], o)).toEqual({ subtotal: 9000, charge: 9000, saving: 0 });
    expect(piecesCharge([3000, 4000], o)).toEqual({ subtotal: 7000, charge: 7000, saving: 0 });
  });
  test("wrong number of pieces never applies the offer", () => {
    expect(piecesCharge([5000], o)).toEqual({ subtotal: 5000, charge: 5000, saving: 0 });
  });
});

describe("sizeInStock (D58)", () => {
  test("own count plus not-assigned pieces", () => {
    expect(sizeInStock(0, 10, 10)).toBe(false);
    expect(sizeInStock(0, 10, 4)).toBe(true);
    expect(sizeInStock(2, 3, 5)).toBe(true);
    expect(sizeInStock(-1, 0, -1)).toBe(false);
  });
});
