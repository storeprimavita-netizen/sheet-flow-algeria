import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PricingCell } from "./pricing-cell";
import { breakEvenState } from "@/lib/pricing-form";
import { DEFAULT_PRICING_SETTINGS as D, computeAll } from "@/lib/pricing-v2";

const html = (state: "value" | "missing" | "impossible", child?: string) =>
  renderToStaticMarkup(
    createElement(PricingCell, { state, missingLabel: "Missing input", impossibleLabel: "Not possible" }, child),
  );

describe("PricingCell", () => {
  it("missing renders an em dash with title + aria-label", () => {
    const out = html("missing");
    expect(out).toContain("—");
    expect(out).toContain('title="Missing input"');
    expect(out).toContain('aria-label="Missing input"');
    expect(out).not.toContain("Not possible");
  });
  it("impossible renders icon + text, not a dash", () => {
    const out = html("impossible");
    expect(out).toContain("Not possible");
    expect(out).toContain("<svg");
    expect(out).not.toContain("—");
  });
  it("value renders its content", () => {
    expect(html("value", "65%")).toContain("65%");
  });
});

describe("breakEvenState", () => {
  const base = { stockCostDzd: 81600, quantity: 50, adCostUsd: { medium: 2.2 } };
  it("complete inputs but price below cost -> Not possible", () => {
    const r = computeAll(D, { ...base, finalPrice: 1000 }).medium;
    expect(r.breakEven.minConfirmation).toBeNull();
    expect(breakEvenState(r, "minConfirmation")).toBe("impossible");
  });
  it("missing ad cost -> missing, not impossible", () => {
    const r = computeAll(D, { ...base, adCostUsd: { medium: null } }).medium;
    expect(breakEvenState(r, "minConfirmation")).toBe("missing");
    expect(breakEvenState(r, "maxAdCostUsd")).toBe("missing");
  });
  it("quantity 0 -> missing", () => {
    const r = computeAll(D, { ...base, quantity: 0 }).medium;
    expect(breakEvenState(r, "minSellingPrice")).toBe("missing");
  });
  it("normal case -> value", () => {
    expect(breakEvenState(computeAll(D, { ...base, finalPrice: 4500 }).medium, "minDelivery")).toBe("value");
  });
});
