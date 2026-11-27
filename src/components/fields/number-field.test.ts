import { describe, expect, it } from "vitest";

import { decimalInput, integerInput, parseNumberInput } from "./number-field";

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

describe("decimalInput", () => {
  it("reads a comma as decimals or as clear grouping", () => {
    expect(decimalInput("12,5")).toBe("12.5");
    expect(decimalInput("0,125")).toBe("0.125");
    expect(decimalInput("1,000.50")).toBe("1000.50");
    expect(decimalInput("1,000,000")).toBe("1000000");
  });
  it("never turns typed grouping into a smaller valid number", () => {
    for (const typed of ["1,000,000", "1,000.50", "25,000"]) {
      const final = Number(typed.replace(/,/g, ""));
      // key by key: once past the first comma, any valid reading of the full text is the full amount
      const result = parseNumberInput(decimalInput(typed));
      expect(Number.isNaN(result) || result === final).toBe(true);
    }
    expect(parseNumberInput(decimalInput("1,000"))).toBeNaN();
  });
});
