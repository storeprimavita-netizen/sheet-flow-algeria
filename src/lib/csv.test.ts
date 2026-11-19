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

describe("toCSV foreign separators (D69)", () => {
  it.each([
    ["Ali;=1+1", `"Ali;'=1+1"`],
    ["Ali\t=1+1", `"Ali\t'=1+1"`],
    ["Ali\n=1+1", `"Ali\n'=1+1"`],
    ["Ali; =1+1", `"Ali;' =1+1"`],
    ['Ali;"=1+1;x', `"Ali;'""=1+1;x"`],
    ["Ali;-x", `"Ali;'-x"`],
    ["Ali;@SUM(A1)", `"Ali;'@SUM(A1)"`],
    ["=a;=b", `"'=a;'=b"`],
    ["-1500\n=1", `"-1500\n'=1"`],
    ["\n=1", `"\n'=1"`],
    ["Ali;Hydra", `"Ali;Hydra"`],
    ["0555123456;+213555123456", `"0555123456;+213555123456"`],
    ["-1500", "-1500"],
    ["-0.5", "-0.5"],
  ])("%j -> %j", (v, out) => {
    expect(csv(v)).toBe(out);
  });
  it("keeps an orders-style row intact", () => {
    const row = toCSV(
      [
        { key: "n", label: "n", value: () => "ORD-1" },
        { key: "c", label: "c", value: () => "Ali;=1+1" },
        { key: "p1", label: "p1", value: () => "+213555123456" },
        { key: "p2", label: "p2", value: () => "0555123456" },
        { key: "a", label: "a", value: () => "Rue 1, Alger" },
        { key: "t", label: "t", value: () => 4500 },
      ],
      [1],
    ).split("\r\n")[1];
    expect(row).toBe(`ORD-1,"Ali;'=1+1",+213555123456,0555123456,"Rue 1, Alger",4500`);
  });
});
