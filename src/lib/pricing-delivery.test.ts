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

import { newOrderBlock } from "./pricing-delivery";

describe("newOrderBlock", () => {
  const r = { ...row, stop_shipping: false };
  it("allows a normal order", () => expect(newOrderBlock(r, "stopdesk")).toBeNull());
  it("blocks stop_shipping and unpriced for any type", () => {
    expect(newOrderBlock({ ...r, stop_shipping: true }, "home")).toBe("stopped");
    expect(newOrderBlock({ ...r, priced: false }, "home")).toBe("unpriced");
  });
  it("blocks stop-desk on a home-only wilaya", () => {
    expect(newOrderBlock({ ...r, stopdesk_available: false }, "stopdesk")).toBe("type_unavailable");
    expect(newOrderBlock({ ...r, stopdesk_available: false }, "home")).toBeNull();
  });
});
