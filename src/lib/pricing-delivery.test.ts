import { describe, expect, it } from "vitest";

import { deliveryFeeFor } from "./pricing-delivery";

const row = { home_fee: 1400, stopdesk_fee: 970, priced: true, stopdesk_available: true };

describe("deliveryFeeFor", () => {
  it("returns the fee per type", () => {
    expect(deliveryFeeFor(row, "home")).toBe(1400);
    expect(deliveryFeeFor(row, "stopdesk")).toBe(970);
  });
  it("home-only wilaya has no stop-desk fee", () => {
    expect(deliveryFeeFor({ ...row, stopdesk_available: false }, "stopdesk")).toBeNull();
    expect(deliveryFeeFor({ ...row, stopdesk_available: false }, "home")).toBe(1400);
  });
  it("unpriced wilaya has no fee at all", () => {
    expect(deliveryFeeFor({ ...row, priced: false }, "home")).toBeNull();
  });
  it("missing row is null", () => {
    expect(deliveryFeeFor(null, "home")).toBeNull();
  });
});
