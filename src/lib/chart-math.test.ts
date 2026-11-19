import { describe, expect, test } from "vitest";

import { arcPath, bandAt, collapseSlices, compactNumber, cumulative, lineSegments, linear, niceTicks, thinIndices, worstFirst, xAt } from "./chart-math";

describe("niceTicks", () => {
  test("positive domain includes 0 and covers max", () => {
    const t = niceTicks(120, 980);
    expect(t.ticks).toContain(0);
    expect(t.max).toBeGreaterThanOrEqual(980);
    expect(t.min).toBe(0);
  });
  test("negative domain still includes 0", () => {
    const t = niceTicks(-5000, -200);
    expect(t.ticks).toContain(0);
    expect(t.min).toBeLessThanOrEqual(-5000);
    expect(t.max).toBe(0);
  });
  test("mixed domain keeps the zero line", () => {
    const t = niceTicks(-300, 700);
    expect(t.ticks).toContain(0);
    expect(t.min).toBeLessThanOrEqual(-300);
    expect(t.max).toBeGreaterThanOrEqual(700);
  });
  test("all zero / empty gives a drawable domain", () => {
    expect(niceTicks(0, 0)).toEqual({ ticks: [0, 1], min: 0, max: 1 });
    expect(niceTicks(NaN, NaN).ticks).toContain(0);
  });
});

describe("scales and positions", () => {
  test("single point sits in the middle; zero-width domain does not divide by zero", () => {
    expect(xAt(0, 1, 10, 110, false)).toBe(60);
    expect(linear(5, 5, 0, 100)(5)).toBe(50);
  });
  test("RTL: oldest point is at the right, so first x > last x", () => {
    expect(xAt(0, 5, 0, 100, true)).toBeGreaterThan(xAt(4, 5, 0, 100, true));
    expect(xAt(0, 5, 0, 100, false)).toBeLessThan(xAt(4, 5, 0, 100, false));
    expect(bandAt(0, 4, 0, 100, true).x).toBeGreaterThan(bandAt(3, 4, 0, 100, true).x);
  });
});

describe("thinIndices", () => {
  test("short axes keep every label", () => expect(thinIndices(5, 8)).toEqual([0, 1, 2, 3, 4]));
  test("more than 90 days thins and keeps first and last", () => {
    const idx = thinIndices(120, 8);
    expect(idx.length).toBeLessThanOrEqual(9);
    expect(idx[0]).toBe(0);
    expect(idx[idx.length - 1]).toBe(119);
  });
  test("empty", () => expect(thinIndices(0, 8)).toEqual([]));
});

describe("lineSegments", () => {
  test("null is a gap, not zero", () => {
    const segs = lineSegments([0, 10, 20, 30], [5, null, 7, 9]);
    expect(segs).toHaveLength(1);
    expect(segs[0].d).toContain("L30.0,9.0");
  });
  test("segment into an immature point is dashed", () => {
    const segs = lineSegments([0, 10, 20], [1, 2, 3], [false, false, true]);
    expect(segs.map((s) => s.dashed)).toEqual([false, true]);
  });
  test("single point has no segment", () => expect(lineSegments([0], [3])).toEqual([]));
});

describe("cumulative / compact / worst", () => {
  test("running total keeps gaps", () => expect(cumulative([1, null, 2, -5])).toEqual([1, null, 3, -2]));
  test("compactNumber", () => {
    expect(compactNumber(1200)).toBe("1.2k");
    expect(compactNumber(-3400000)).toBe("−3.4M");
    expect(compactNumber(0)).toBe("0");
  });
  test("worstFirst applies the min-count floor", () => {
    const rows = [
      { n: "tiny", c: 2, r: 0 },
      { n: "bad", c: 50, r: 0.2 },
      { n: "ok", c: 80, r: 0.8 },
      { n: "gap", c: 90, r: null },
    ];
    const out = worstFirst(rows, (r) => r.c, (r) => r.r, 10, 5).map((r) => r.n);
    expect(out).toEqual(["bad", "ok"]);
  });
});

describe("collapseSlices / arcPath", () => {
  const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, label: `L${i}`, value: 10 - i }));
  test("<= max stays as is", () => expect(collapseSlices(mk(5), 5, "Other")).toHaveLength(5));
  test("collapses to max incl. Other with the sum of the rest", () => {
    const out = collapseSlices(mk(8), 5, "Other");
    expect(out).toHaveLength(5);
    expect(out[4]).toEqual({ key: "other", label: "Other", value: 6 + 5 + 4 + 3 });
    expect(out.reduce((s, x) => s + x.value, 0)).toBe(mk(8).reduce((s, x) => s + x.value, 0));
  });
  test("zero slices are dropped", () => expect(collapseSlices([{ key: "a", label: "a", value: 0 }], 5, "Other")).toEqual([]));
  test("a full circle is a valid path", () => expect(arcPath(50, 50, 30, 45, 0, 1)).toMatch(/^M.*Z$/));
});
