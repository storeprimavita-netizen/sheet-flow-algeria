import { describe, expect, test } from "vitest";

import { formInputSchema, offersInputSchema, pricingInputSchema } from "./selling-schemas";

const id = "4f1c9d8e-7a3b-4c2d-9e5f-1a2b3c4d5e6f";
const offer = { id: null, label: "x2", qty: 2, total: 9000, isDefault: false, isActive: true, activeFrom: null, activeTo: null };

describe("selling schemas", () => {
  test("pricing: whole DZD only, strict", () => {
    const ok = { productId: id, mode: "per_value", compareAt: null, deltas: [{ valueId: id, delta: -200 }], overrides: [] };
    expect(pricingInputSchema.safeParse(ok).success).toBe(true);
    expect(pricingInputSchema.safeParse({ ...ok, compareAt: 10.5 }).success).toBe(false);
    expect(pricingInputSchema.safeParse({ ...ok, deltas: [{ valueId: id, delta: 1.5 }] }).success).toBe(false);
    expect(pricingInputSchema.safeParse({ ...ok, mode: "x" }).success).toBe(false);
    expect(pricingInputSchema.safeParse({ ...ok, cost: 1 }).success).toBe(false);
  });
  test("offers: qty range, one default, window, label", () => {
    const base = { productId: id, bump: null };
    expect(offersInputSchema.safeParse({ ...base, offers: [offer] }).success).toBe(true);
    expect(offersInputSchema.safeParse({ ...base, offers: [{ ...offer, qty: 1 }] }).success).toBe(false);
    expect(offersInputSchema.safeParse({ ...base, offers: [{ ...offer, isDefault: true }, { ...offer, qty: 3, isDefault: true }] }).success).toBe(false);
    expect(offersInputSchema.safeParse({ ...base, offers: [{ ...offer, activeFrom: "2026-02-01T00:00:00Z", activeTo: "2026-01-01T00:00:00Z" }] }).success).toBe(false);
    expect(offersInputSchema.safeParse({ ...base, offers: [{ ...offer, label: "<b>" }] }).success).toBe(false);
    expect(offersInputSchema.safeParse({ ...base, offers: [{ ...offer, free_delivery: true }] }).success).toBe(false);
    expect(offersInputSchema.safeParse({ ...base, offers: Array.from({ length: 7 }, () => offer) }).success).toBe(false);
  });
  test("form: needs a delivery method", () => {
    expect(formInputSchema.safeParse({ productId: id, fields: [], deliveryMethods: [] }).success).toBe(false);
    expect(formInputSchema.safeParse({ productId: id, fields: [], deliveryMethods: ["home"] }).success).toBe(true);
  });
});
