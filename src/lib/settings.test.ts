import { describe, expect, test } from "vitest";

import { SETTINGS_SCHEMAS } from "@/lib/settings";

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
