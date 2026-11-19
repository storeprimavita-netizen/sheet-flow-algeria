import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { WILAYA_CENTROIDS, ALGERIA_OUTLINE } from "@/lib/geo/algeria-wilayas";
import { wilayaTitle, type WilayaMapDatum } from "@/components/dashboard/algeria-map";
import { normalizeText } from "@/lib/utils";

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

  it("names match the seed list for codes 1..58", () => {
    const seed = readFileSync("supabase/migrations/00007_seed.sql", "utf8");
    const pairs = [...seed.matchAll(/\((\d+),'((?:[^']|'')*)'\)/g)];
    expect(pairs).toHaveLength(58);
    for (const [, code, name] of pairs) {
      expect(normalizeText(WILAYA_CENTROIDS[Number(code)].name)).toBe(normalizeText(name.replace(/''/g, "'")));
    }
  });

  it("southern wilayas sit under the right codes", () => {
    expect(WILAYA_CENTROIDS[49].lat).toBeCloseTo(29.3, 0);
    expect(WILAYA_CENTROIDS[49].lon).toBeCloseTo(0.2, 0);
    expect(WILAYA_CENTROIDS[58].lat).toBeCloseTo(30.6, 0);
    expect(WILAYA_CENTROIDS[58].lon).toBeCloseTo(2.9, 0);
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

describe("wilaya legend bidi", () => {
  // No component test setup (jsdom/RTL) in this repo, so assert on source.
  const src = readFileSync("src/components/stats/wilaya-section.tsx", "utf8");
  it("wraps every range label in bdi dir=ltr", () => {
    for (const label of ["&lt;40%", "40–55%", "55–70%", "70–85%", "85%+"]) {
      expect(src).toContain(`<bdi dir="ltr">${label}</bdi>`);
    }
  });
});

const datum = (o: Partial<WilayaMapDatum>): WilayaMapDatum => ({
  code: 16, name: null, totalOrders: 0, deliveryRate: null, matured: true, ...o,
});

describe("wilayaTitle", () => {
  it("falls back name -> names map -> code", () => {
    expect(wilayaTitle(datum({ name: "Alger", totalOrders: 4, deliveryRate: 50 }), "No data", { 16: "X" })).toBe("Alger — 50% (4)");
    expect(wilayaTitle(datum({ totalOrders: 4, deliveryRate: 50 }), "No data", { 16: "Alger" })).toBe("Alger — 50% (4)");
    expect(wilayaTitle(datum({ totalOrders: 4, deliveryRate: null }), "No data")).toBe("16 — — (4)");
  });
  it("uses the no-data label with zero orders", () => {
    expect(wilayaTitle(datum({}), "No data")).toBe("16 — No data");
  });
});

describe("wilaya table label structure", () => {
  const src = readFileSync("src/components/stats/wilaya-table.tsx", "utf8");
  it("renders ltr code, readable separator, name in bdi", () => {
    expect(src).toContain('<bdi dir="ltr">{code}</bdi><span> · </span><bdi>{w.name}</bdi>');
    expect(src).not.toContain("<span aria-hidden> · </span>");
  });
  it("has a scroll-fade hint on the table", () => {
    expect(src).toContain("data-scroll-fade");
  });
});

describe("AlgeriaMap matured fill", () => {
  const src = readFileSync("src/components/dashboard/algeria-map.tsx", "utf8");
  it("an unmatured datum takes the neutral fill, not a status fill", () => {
    expect(src).toContain('if (!d.matured || d.deliveryRate === null) return "fill-neutral/30"');
    expect(src).not.toContain("minOrders");
  });
});
