import { describe, expect, it } from "vitest";

import { toCSV } from "@/lib/csv";

const csv = (v: string | number) => toCSV([{ key: "a", label: "a", value: () => v }], [1]).split("\r\n")[1];

describe("toCSV formula neutralisation", () => {
  it.each(["=cmd", "+1+cmd|x", "-x", "-2+3", "@SUM(A1)", "\tx", " =1+1", "\uFF1D1"])("prefixes %j with an apostrophe", (v) => {
    expect(csv(v).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
  });
  it.each(["+213555123456", "+213 555 12 34 56", "0555123456"])("leaves phone %j unchanged", (v) => {
    expect(csv(v)).toBe(v);
  });
  it("leaves numbers and plain text alone", () => {
    expect(csv(-10274)).toBe("-10274");
    expect(csv("BENZ")).toBe("BENZ");
  });
  it("neutralises then quotes a formula with quotes", () => {
    expect(csv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
});
