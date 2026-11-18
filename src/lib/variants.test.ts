import { describe, expect, it } from "vitest";

import { countBySizeSchema, missingCombos, notAssigned, variantConfigSchema, variantLabel, variantStatus, type VariantOption } from "./variants";

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const size: VariantOption = { id: u(1), name: "Size", values: [{ id: u(2), label: "S" }, { id: u(3), label: "M" }] };
const color: VariantOption = { id: u(4), name: "Color", values: [{ id: u(5), label: "Red" }, { id: u(6), label: "Blue" }] };

describe("variantLabel", () => {
  it("follows option order, not insertion order", () => {
    expect(variantLabel([size, color], { [color.id]: u(5), [size.id]: u(3) })).toBe("M / Red");
  });
});

describe("missingCombos", () => {
  it("lists only uncovered combinations", () => {
    const combos = missingCombos([size, color], [{ [size.id]: u(2), [color.id]: u(5) }]);
    expect(combos).toHaveLength(3);
    expect(combos.find((c) => c[size.id] === u(2) && c[color.id] === u(5))).toBeUndefined();
  });
  it("returns nothing without options or with an empty option", () => {
    expect(missingCombos([], [])).toEqual([]);
    expect(missingCombos([{ ...size, values: [] }], [])).toEqual([]);
  });
});

describe("variantStatus", () => {
  it("is count_needed when a size is negative or pieces are not assigned", () => {
    expect(variantStatus([], 5)).toBe("no_variants");
    expect(variantStatus([3, -1], 0)).toBe("count_needed");
    expect(variantStatus([3, 4], 2)).toBe("count_needed");
    expect(variantStatus([3, 4], 0)).toBe("ok");
  });
  it("not assigned = total - every size", () => {
    expect(notAssigned(10, [3, 4])).toBe(3);
    expect(notAssigned(2, [3, 4])).toBe(-5);
  });
});

describe("variantConfigSchema", () => {
  const base = { options: [size], variants: [{ id: u(10), sku: " ", is_active: true, values: { [size.id]: u(2) } }] };
  it("accepts a valid config and blanks an empty sku", () => {
    const r = variantConfigSchema.parse(base);
    expect(r.variants[0].sku).toBeNull();
  });
  it("refuses a duplicate value label in one option (case-insensitive)", () => {
    const o = { ...size, values: [{ id: u(2), label: "S" }, { id: u(3), label: " s " }] };
    expect(variantConfigSchema.safeParse({ options: [o], variants: [] }).success).toBe(false);
  });
  it("refuses a variant missing an option or with a value of another option", () => {
    expect(variantConfigSchema.safeParse({ options: [size, color], variants: base.variants }).success).toBe(false);
    expect(variantConfigSchema.safeParse({ options: [size], variants: [{ ...base.variants[0], values: { [size.id]: u(5) } }] }).success).toBe(false);
  });
  it("refuses two variants with the same values", () => {
    const dup = { ...base.variants[0], id: u(11) };
    expect(variantConfigSchema.safeParse({ options: [size], variants: [base.variants[0], dup] }).success).toBe(false);
  });
});

describe("countBySizeSchema", () => {
  it("takes absolute whole counts, never negative", () => {
    expect(countBySizeSchema.safeParse([{ variant_id: u(10), count: 4 }]).success).toBe(true);
    expect(countBySizeSchema.safeParse([{ variant_id: u(10), count: -1 }]).success).toBe(false);
    expect(countBySizeSchema.safeParse([{ variant_id: u(10), count: 1.5 }]).success).toBe(false);
    expect(countBySizeSchema.safeParse([]).success).toBe(false);
  });
});
