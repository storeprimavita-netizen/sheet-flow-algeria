import { describe, expect, it } from "vitest";

import { toCSV } from "@/lib/csv";

const csv = (v: string | number) => toCSV([{ key: "a", label: "a", value: () => v }], [1]).split("\r\n")[1];

describe("toCSV formula neutralisation", () => {
  it.each(["=cmd", "+1", "-x", "@x", "\tx"])("prefixes %j with an apostrophe", (v) => {
    expect(csv(v).replace(/^"|"$/g, "").startsWith("'")).toBe(true);
  });
  it("leaves numbers and plain text alone", () => {
    expect(csv(-10274)).toBe("-10274");
    expect(csv("BENZ")).toBe("BENZ");
  });
  it("neutralises then quotes a formula with quotes", () => {
    expect(csv('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
});
