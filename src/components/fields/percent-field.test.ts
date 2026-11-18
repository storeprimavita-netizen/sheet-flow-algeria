import { describe, expect, it } from "vitest";

import { blurChange, normalizePercent, parsePercentInput } from "./percent-field";

describe("PercentField helpers", () => {
  it("max above 100 is reachable (markup 150%, cap 1000%)", () => {
    expect(normalizePercent("150", 1000, 2)).toBe("150");
    expect(normalizePercent("1500", 1000, 2)).toBe("1000");
    expect(normalizePercent("150", 100, 1)).toBe("100"); // default still clamps
  });
  it("keeps 2 decimals when asked (0.75 not 0.8)", () => {
    expect(normalizePercent("0.75", 100, 2)).toBe("0.75");
    expect(normalizePercent("0.75", 100, 1)).toBe("0.8");
  });
  it("empty -> null when nullable, 0 otherwise; blur keeps empty", () => {
    expect(parsePercentInput("", true)).toBeNull();
    expect(parsePercentInput("", false)).toBe(0);
    expect(parsePercentInput("12.5", true)).toBe(12.5);
    expect(parsePercentInput("5.5.5", true)).toBeNaN();
    expect(blurChange("5.5.5", 100, 2, true)).toBeNull();
    expect(normalizePercent("", 100, 1)).toBe("");
  });
  it("blur reports the clamped/rounded value, not the typed one", () => {
    expect(blurChange("120", 100, 1, false)).toEqual({ text: "100", value: 100 });
    expect(blurChange("1500", 1000, 2, true)).toEqual({ text: "1000", value: 1000 });
    expect(blurChange("33.333", 100, 2, false)).toEqual({ text: "33.33", value: 33.33 });
    expect(blurChange("50", 100, 1, false)).toBeNull();
  });
});
