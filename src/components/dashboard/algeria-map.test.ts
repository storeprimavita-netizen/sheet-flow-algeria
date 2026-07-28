import { describe, expect, it } from "vitest";

import { WILAYA_GRID } from "./algeria-map";

describe("WILAYA_GRID", () => {
  it("has exactly the 58 wilaya codes, no duplicates", () => {
    const codes = Object.keys(WILAYA_GRID).map(Number).sort((a, b) => a - b);
    expect(codes).toEqual(Array.from({ length: 58 }, (_, i) => i + 1));
  });

  it("has no two wilayas sharing a grid cell", () => {
    const seen = new Set<string>();
    for (const pos of Object.values(WILAYA_GRID)) {
      const key = `${pos.x},${pos.y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
