import { describe, expect, test } from "vitest";

import { asKpiDaily } from "@/lib/kpi";

const row = (day: string) => ({ day, rates: { counts: {} }, money: null, immature: false });

describe("asKpiDaily", () => {
  test("returns days oldest first", () => {
    expect(asKpiDaily([row("2026-03-12"), row("2026-03-10"), row("2026-03-11")]).map((r) => r.day)).toEqual(["2026-03-10", "2026-03-11", "2026-03-12"]);
  });
});
