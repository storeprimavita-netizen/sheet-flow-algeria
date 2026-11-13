import { describe, expect, it } from "vitest";

import { WILAYA_CENTROIDS, ALGERIA_OUTLINE } from "@/lib/geo/algeria-wilayas";

describe("WILAYA_CENTROIDS", () => {
  it("has exactly the 58 wilaya codes, no duplicates", () => {
    const codes = Object.keys(WILAYA_CENTROIDS).map(Number).sort((a, b) => a - b);
    expect(codes).toEqual(Array.from({ length: 58 }, (_, i) => i + 1));
  });

  it("every centroid falls within Algeria's real lat/lon range", () => {
    for (const { lat, lon } of Object.values(WILAYA_CENTROIDS)) {
      expect(lat).toBeGreaterThan(18);
      expect(lat).toBeLessThan(38);
      expect(lon).toBeGreaterThan(-9);
      expect(lon).toBeLessThan(13);
    }
  });
});

describe("ALGERIA_OUTLINE", () => {
  it("is a closed ring with enough points to render smoothly", () => {
    expect(ALGERIA_OUTLINE.length).toBeGreaterThan(50);
    const [first] = ALGERIA_OUTLINE;
    const last = ALGERIA_OUTLINE[ALGERIA_OUTLINE.length - 1];
    expect(last).toEqual(first);
  });
});
