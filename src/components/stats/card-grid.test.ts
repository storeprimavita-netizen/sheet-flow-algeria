import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

/** CHART-1: stat cards carry a Lucide icon and never sit more than 4 in a row (charts follow). */
const dirs = ["dashboard", "stats"].map((d) => path.resolve(__dirname, "..", d));
const files = dirs.flatMap((d) => readdirSync(d).filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f)).map((f) => path.join(d, f)));

describe("card grids", () => {
  for (const f of files) {
    // 12 is the page layout grid, not a row of cards
    test(`${path.basename(f)}: at most 4 columns on large screens`, () => {
      expect(readFileSync(f, "utf8")).not.toMatch(/(lg|xl|2xl):grid-cols-([5-9]|1[01])\b/);
    });
  }
  test("every dashboard KpiTile has an icon", () => {
    for (const f of files.filter((x) => x.includes(`${path.sep}dashboard${path.sep}`))) {
      const src = readFileSync(f, "utf8");
      const tiles = src.match(/<KpiTile\b[\s\S]*?(?=\/>)/g) ?? [];
      for (const tile of tiles) expect(tile, path.basename(f)).toMatch(/\bicon=/);
    }
  });
});
