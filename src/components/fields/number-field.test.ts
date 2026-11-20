import { describe, expect, it } from "vitest";

import { integerInput, parseNumberInput } from "./number-field";

describe("parseNumberInput", () => {
  it("empty or lone dot -> null", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput(".")).toBeNull();
  });
  it("garbage like 1.2.3 never yields NaN", () => {
    expect(parseNumberInput("1.2.3")).toBeNaN();
    expect(parseNumberInput("12.5")).toBe(12.5);
  });
});

describe("integerInput", () => {
  it("never joins digits across a decimal point", () => {
    expect(integerInput("2500.00")).toBe("2500");
    expect(integerInput("2500.5")).toBe("2500");
    expect(integerInput("25a00")).toBe("2500");
  });
});
