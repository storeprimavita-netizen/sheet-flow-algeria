import { describe, expect, test } from "vitest";

import { SETTINGS_SCHEMAS } from "@/lib/settings";

describe("zr_state_map", () => {
  test("zr_state_map with swap is sanitised, not dropped", () => {
    const r = SETTINGS_SCHEMAS.zr_state_map.parse({ map: { livre: "delivered", echange: "swap" } });
    expect(r.map).toEqual({ livre: "delivered" });
  });
});
