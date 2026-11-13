import { describe, expect, it } from "vitest";

import { customerDeliveryRate, normalizeDzPhone } from "./customers";

// Pinned against the SQL cases in normalize_dz_phone() (00001_core.sql).
describe("normalizeDzPhone", () => {
  it("passes through an already-normalized number", () => {
    expect(normalizeDzPhone("0555123456")).toBe("0555123456");
  });
  it("strips spacing/punctuation", () => {
    expect(normalizeDzPhone("05 55 12 34 56")).toBe("0555123456");
  });
  it("handles +213 international format", () => {
    expect(normalizeDzPhone("+213555123456")).toBe("0555123456");
  });
  it("handles 00213 international format", () => {
    expect(normalizeDzPhone("00213555123456")).toBe("0555123456");
  });
  it("handles 213-prefixed without leading zero", () => {
    expect(normalizeDzPhone("213555123456")).toBe("0555123456");
  });
  it("handles a 9-digit number missing its leading zero", () => {
    expect(normalizeDzPhone("555123456")).toBe("0555123456");
  });
  it("returns unmatched digits unchanged", () => {
    expect(normalizeDzPhone("12345")).toBe("12345");
  });
});

describe("customerDeliveryRate (15j: closed orders only)", () => {
  it("ignores open orders in the denominator", () => {
    expect(customerDeliveryRate({ delivered_orders: 1, returned_orders: 0, cancelled_orders: 0 })?.label).toBe("100% (1/1)");
    expect(customerDeliveryRate({ delivered_orders: 1, returned_orders: 1, cancelled_orders: 2 })?.label).toBe("25% (1/4)");
  });
  it("is null with no closed order", () => {
    expect(customerDeliveryRate({ delivered_orders: 0, returned_orders: 0, cancelled_orders: 0 })).toBeNull();
    expect(customerDeliveryRate(null)).toBeNull();
  });
});
