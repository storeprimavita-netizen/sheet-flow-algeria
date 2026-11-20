import { describe, expect, test } from "vitest";
import { AUDITED_TABLES, nextDayStart, dayStart, parseAuditParams } from "./params";

const U = "123e4567-e89b-12d3-a456-426614174000";

describe("parseAuditParams", () => {
  test("keeps valid values", () => {
    expect(parseAuditParams({ table: "settings", actor: U, from: "2026-02-28", to: "2026-03-01" })).toEqual({ table: "settings", actor: U, from: "2026-02-28", to: "2026-03-01" });
  });
  test("drops impossible dates, non-uuid actor, unknown table, arrays", () => {
    expect(parseAuditParams({ table: "profiles", actor: "nope", from: "2026-02-31", to: "2026-13-01" })).toEqual({ table: "", actor: "", from: "", to: "" });
    expect(parseAuditParams({ table: ["settings"], from: ["2026-01-01"] })).toEqual({ table: "", actor: "", from: "", to: "" });
  });
  test("every newly audited table is accepted", () => {
    for (const t of AUDITED_TABLES) expect(parseAuditParams({ table: t }).table).toBe(t);
  });
});

describe("day bounds", () => {
  test("fixed +01:00 zone, next day rolls over months and leap years", () => {
    expect(dayStart("2026-01-05")).toBe("2026-01-05T00:00:00+01:00");
    expect(nextDayStart("2026-02-28")).toBe("2026-03-01T00:00:00+01:00");
    expect(nextDayStart("2028-02-28")).toBe("2028-02-29T00:00:00+01:00");
    expect(nextDayStart("2026-12-31")).toBe("2027-01-01T00:00:00+01:00");
  });
});
