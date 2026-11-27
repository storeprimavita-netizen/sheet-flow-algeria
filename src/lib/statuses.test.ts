import { describe, expect, test } from "vitest";

import { STUCK_DAYS, stuckCutoff } from "@/lib/statuses";

describe("stuckCutoff", () => {
  test("is STUCK_DAYS before now, as ISO", () => {
    const now = Date.parse("2026-01-10T12:00:00.000Z");
    expect(stuckCutoff(now)).toBe(new Date(now - STUCK_DAYS * 86400000).toISOString());
    expect(stuckCutoff(now)).toBe("2026-01-05T12:00:00.000Z");
  });
});
