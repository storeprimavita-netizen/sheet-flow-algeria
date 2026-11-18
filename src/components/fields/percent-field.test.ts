import { describe, expect, it } from "vitest";

import { normalizePercent, parsePercentInput } from "./percent-field";

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
    expect(normalizePercent("", 100, 1)).toBe("");
  });
});
