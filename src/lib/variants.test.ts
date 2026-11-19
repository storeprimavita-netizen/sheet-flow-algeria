import { describe, expect, it } from "vitest";

import { countBySizeSchema, mergeSizeSet, missingCombos, sizeSetSchema, skuSuggestion, notAssigned, variantConfigSchema, variantLabel, variantStatus, isSizeOption, storeOptionHeadingKey, variantFailureCode, type VariantOption } from "./variants";

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
  it("refuses sizes when there are no options", () => {
    expect(variantConfigSchema.safeParse({ options: [], variants: [{ id: u(10), sku: null, is_active: true, values: {} }] }).success).toBe(false);
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

describe("variantConfigSchema backfill (VAR-1)", () => {
  const base = () => ({
    options: [
      { id: u(1), name: "Size", values: [{ id: u(2), label: "S" }] },
      { id: u(4), name: "Color", kind: "color", values: [{ id: u(5), label: "Red", swatch_color: "#ff0000" }, { id: u(6), label: "Blue" }] },
    ],
    variants: [{ id: u(10), sku: null, is_active: true, existing: true, values: { [u(1)]: u(2), [u(4)]: u(5) } }],
    backfill: { [u(4)]: u(5) },
  });
  it("passes when saved sizes carry the backfilled value and new ones choose their own", () => {
    const c = base();
    c.variants.push({ id: u(11), sku: null, is_active: true, existing: false, values: { [u(1)]: u(2), [u(4)]: u(6) } } as never);
    expect(variantConfigSchema.safeParse(c).success).toBe(true);
  });
  it("refuses a saved size whose copy differs from the backfill, or a foreign backfill value", () => {
    const c = base();
    c.variants[0].values[u(4)] = u(6);
    expect(variantConfigSchema.safeParse(c).success).toBe(false);
    const d = base();
    d.backfill = { [u(4)]: u(2) };
    expect(variantConfigSchema.safeParse(d).success).toBe(false);
    const e = base();
    e.backfill = { [u(1)]: u(2), [u(4)]: u(5) };
    expect(variantConfigSchema.safeParse(e).success).toBe(true); // keyed by a payload option: SQL refuses an existing one
  });
  it("swatches: hex or https only, never both, only on color options, one color option", () => {
    const ok = (mut: (c: ReturnType<typeof base>) => void) => {
      const c = base();
      mut(c);
      return variantConfigSchema.safeParse(c).success;
    };
    const val = (c: ReturnType<typeof base>) => c.options[1].values[1] as Record<string, unknown>;
    expect(ok((c) => (val(c).swatch_image = "https://cdn.example.com/a.jpg"))).toBe(true);
    for (const bad of ["http://a/x.png", "javascript:alert(1)", "https://a/x.png)", "https://a/x y.png", 'https://a/"x', "https://a/x'"]) {
      expect(ok((c) => (val(c).swatch_image = bad))).toBe(false);
    }
    expect(ok((c) => (val(c).swatch_color = "red"))).toBe(false);
    expect(ok((c) => ((val(c).swatch_color = "#00ff00"), (val(c).swatch_image = "https://a/x.png")))).toBe(false);
    expect(ok((c) => ((c.options[0] as Record<string, unknown>).swatch = 1, (c.options[0].values[0] as Record<string, unknown>).swatch_color = "#00ff00"))).toBe(false);
    expect(ok((c) => ((c.options[0] as Record<string, unknown>).kind = "color"))).toBe(false);
  });
});

describe("skuSuggestion", () => {
  it("joins code and value initials, uppercased", () => {
    expect(skuSuggestion("aba-01", [{ label: "Medium", index: 2 }, { label: "Red", index: 0 }], [])).toBe("ABA01-MED-RED");
  });
  it("falls back to the position for Arabic values", () => {
    expect(skuSuggestion("ABA", [{ label: "أحمر", index: 1 }], [])).toBe("ABA-2");
  });
  it("adds -2, -3 on collisions, case-insensitively", () => {
    expect(skuSuggestion("A", [{ label: "M", index: 0 }], ["a-m", "A-M-2"])).toBe("A-M-3");
  });
});

describe("size sets", () => {
  it("trims, rejects blanks, >60 chars and >40 items", () => {
    expect(sizeSetSchema.parse({ name: " Adults ", items: [" S ", "M"] })).toEqual({ name: "Adults", items: ["S", "M"] });
    expect(sizeSetSchema.safeParse({ name: "x", items: [" "] }).success).toBe(false);
    expect(sizeSetSchema.safeParse({ name: "x", items: ["a".repeat(61)] }).success).toBe(false);
    expect(sizeSetSchema.safeParse({ name: "x", items: Array.from({ length: 41 }, (_, i) => String(i)) }).success).toBe(false);
    expect(sizeSetSchema.safeParse({ name: "x", items: [] }).success).toBe(false);
  });
  it("merge keeps existing values and appends only missing names", () => {
    expect(mergeSizeSet(["S", "m"], ["S", "M", "L", "l"])).toEqual(["L"]);
  });
});

describe("isSizeOption (VAR-1)", () => {
  it("treats legacy Variant and any-locale Size as the size option", () => {
    for (const name of ["Variant", " size ", "المقاس", "SIZE"]) expect(isSizeOption({ name, kind: "text" })).toBe(true);
  });
  it("ignores colour options and other names", () => {
    expect(isSizeOption({ name: "Size", kind: "color" })).toBe(false);
    expect(isSizeOption({ name: "Material" })).toBe(false);
  });
});

describe("storeOptionHeadingKey (VAR-1)", () => {
  it("sizes, colour, or the owner's own name", () => {
    for (const name of ["Size", " size ", "Variant", "المقاس"]) expect(storeOptionHeadingKey({ name, kind: "text" })).toBe("sizes");
    for (const kind of ["color", "text"] as const)
      for (const name of ["Color", "Colour", "اللون"]) expect(storeOptionHeadingKey({ name, kind })).toBe("color");
    for (const name of ["Material", "القماش"]) expect(storeOptionHeadingKey({ name, kind: "text" })).toBeNull();
  });
});

describe("variantFailureCode (VAR-1)", () => {
  it("maps database errors to codes only", () => {
    expect(variantFailureCode({ message: "incomplete size" })).toBe("invalid");
    expect(variantFailureCode({ message: "every size needs exactly one value for each option" })).toBe("invalid");
    expect(variantFailureCode({ message: "stale" })).toBe("stale");
    expect(variantFailureCode({ code: "23503", message: "fk" })).toBe("in_use");
    expect(variantFailureCode({ message: "relation foo exploded" })).toBe("failed");
  });
});
