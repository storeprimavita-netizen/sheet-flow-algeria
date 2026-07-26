import { describe, expect, it } from "vitest";

import { formatDuration } from "./format";

describe("formatDuration", () => {
  it("returns — for null/undefined", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(undefined)).toBe("—");
  });
  it("formats a plain HH:MM:SS interval", () => {
    expect(formatDuration("02:15:00")).toBe("2h 15m");
  });
  it("formats a sub-hour interval as minutes only", () => {
    expect(formatDuration("00:45:00")).toBe("45m");
  });
  it("formats a multi-day interval (Postgres 'N days HH:MM:SS' style)", () => {
    expect(formatDuration("3 days 01:02:03")).toBe("3d 1h 2m");
  });
  it("falls back to 0m when the interval is all zeros", () => {
    expect(formatDuration("00:00:00")).toBe("0m");
  });
});
