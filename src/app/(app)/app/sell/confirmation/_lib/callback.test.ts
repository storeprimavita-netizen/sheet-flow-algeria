import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { algiersToIso, formatAlgiersDateTime, isoToAlgiers } from "./callback";

describe("Algiers callback instants under a UTC process", () => {
  const tz = process.env.TZ;
  beforeAll(() => { process.env.TZ = "UTC"; });
  afterAll(() => { process.env.TZ = tz; });

  test("converts an explicit Algiers date and time, including late evening and just after midnight", () => {
    expect(algiersToIso("2026-11-27", "23:30")).toBe("2026-11-27T22:30:00.000Z");
    expect(algiersToIso("2026-11-28", "00:15")).toBe("2026-11-27T23:15:00.000Z");
    expect(isoToAlgiers("2026-11-27T23:15:00Z")).toEqual({ date: "2026-11-28", time: "00:15" });
    expect(formatAlgiersDateTime("2026-11-27T23:15:00Z")).toContain("28/11/2026 00:15");
  });

  test("rejects missing, malformed and impossible values", () => {
    for (const [date, time] of [["", "10:00"], ["2026-11-27", ""], ["2026-02-31", "10:00"], ["2026-13-01", "10:00"], ["2026-11-27", "24:00"], ["27/11/2026", "10:00"]]) {
      expect(algiersToIso(date, time), `${date} ${time}`).toBeNull();
    }
    expect(isoToAlgiers(null)).toEqual({ date: "", time: "" });
  });
});
