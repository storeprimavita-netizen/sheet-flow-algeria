import { describe, expect, it } from "vitest";

import { normalizeDzPhone } from "./customers";

// Pinned against the SQL cases in normalize_dz_phone() (00001_core.sql).
describe("normalizeDzPhone", () => {
  it("passes through an already-normalized number", () => {
    expect(normalizeDzPhone("0555123456")).toBe("0555123456");
  });
  it("strips spacing/punctuation", () => {
    expect(normalizeDzPhone("05 55 12 34 56")).toBe("0555123456");
  });
  it("handles +213 international format", () => {
    expect(normalizeDzPhone("+213555123456")).toBe("0555123456");
  });
  it("handles 00213 international format", () => {
    expect(normalizeDzPhone("00213555123456")).toBe("0555123456");
  });
  it("handles 213-prefixed without leading zero", () => {
    expect(normalizeDzPhone("213555123456")).toBe("0555123456");
  });
  it("handles a 9-digit number missing its leading zero", () => {
    expect(normalizeDzPhone("555123456")).toBe("0555123456");
  });
  it("returns unmatched digits unchanged", () => {
    expect(normalizeDzPhone("12345")).toBe("12345");
  });
});
