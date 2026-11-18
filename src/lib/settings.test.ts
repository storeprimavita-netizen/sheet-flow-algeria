import { describe, expect, test } from "vitest";

import { SETTINGS_SCHEMAS } from "@/lib/settings";
import { DEFAULT_PRICING_SETTINGS } from "@/lib/pricing-v2";

describe("zr_state_map", () => {
  test("zr_state_map with swap is sanitised, not dropped", () => {
    const r = SETTINGS_SCHEMAS.zr_state_map.parse({ map: { livre: "delivered", echange: "swap" } });
    expect(r.map).toEqual({ livre: "delivered" });
  });

  test("map without swap is unchanged", () => {
    expect(SETTINGS_SCHEMAS.zr_state_map.parse({ map: { livre: "delivered" } }).map).toEqual({ livre: "delivered" });
  });
  test("invalid enum value is rejected", () => {
    expect(SETTINGS_SCHEMAS.zr_state_map.safeParse({ map: { x: "bogus" } }).success).toBe(false);
  });
  test("non-object map is rejected", () => {
    expect(SETTINGS_SCHEMAS.zr_state_map.safeParse({ map: "x" }).success).toBe(false);
  });
});

describe("pricing_defaults", () => {
  test("strict save: profit 1500 ok, markup 11 (fraction) refused, share 101% refused", () => {
    const ok = SETTINGS_SCHEMAS.pricing_defaults;
    expect(ok.safeParse(DEFAULT_PRICING_SETTINGS).success).toBe(true);
    expect(ok.safeParse({ ...DEFAULT_PRICING_SETTINGS, target: { mode: "markup", value: 11 } }).success).toBe(false);
    expect(ok.safeParse({ ...DEFAULT_PRICING_SETTINGS, share: 1.01 }).success).toBe(false);
  });
});
