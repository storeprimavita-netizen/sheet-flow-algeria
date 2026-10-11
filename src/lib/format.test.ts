import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatDuration } from "./format";

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

describe("formatCurrency", () => {
  it("whole DA, space-grouped with non-breaking spaces", () => {
    expect(formatCurrency(135900)).toBe("\u2066135\u00a0900\u00a0DA\u2069");
    expect(formatCurrency("7772.56")).toBe("\u20667\u00a0773\u00a0DA\u2069");
  });
  it("never renders -0", () => {
    expect(formatCurrency(-0.3)).toBe("\u20660\u00a0DA\u2069");
  });
  it("— for empty", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency("")).toBe("—");
    expect(formatCurrency("abc")).toBe("—");
  });
});

describe("formatDate", () => {
  it("dd/mm/yyyy with no UTC day shift for ISO dates", () => {
    expect(formatDate("2026-10-01")).toBe("01/10/2026");
  });
});
