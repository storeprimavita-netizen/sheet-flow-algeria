import { describe, expect, it } from "vitest";

import { algiersDayStart, countDelivery, countMyChanges } from "@/lib/my-day";

describe("algiersDayStart", () => {
  it("is local midnight in UTC+1", () => {
    expect(algiersDayStart(new Date("2026-03-10T12:00:00Z"))).toBe("2026-03-09T23:00:00.000Z");
    expect(algiersDayStart(new Date("2026-03-10T23:30:00Z"))).toBe("2026-03-10T23:00:00.000Z"); // already 00:30 on the 11th in Algiers
    expect(algiersDayStart(new Date("2026-03-10T00:30:00Z"))).toBe("2026-03-09T23:00:00.000Z");
  });
});

describe("countMyChanges", () => {
  const r = (order_id: string, to_status: string, at: number) => ({ order_id, to_status, created_at: new Date(at).toISOString() });
  it("counts each order once under the last change", () => {
    expect(countMyChanges([r("a", "no_answer", 1), r("a", "confirmed", 2), r("b", "cancelled", 3), r("c", "closed_phone", 4)])).toEqual({
      confirmed: 1, cancelled: 1, callAgain: 1, handled: 3,
    });
    expect(countMyChanges([r("a", "confirmed", 1), r("a", "no_answer", 2)])).toEqual({ confirmed: 0, cancelled: 0, callAgain: 1, handled: 1 });
    expect(countMyChanges([])).toEqual({ confirmed: 0, cancelled: 0, callAgain: 0, handled: 0 });
  });
});

describe("countDelivery", () => {
  const r = (order_id: string, to_status: string, n: number) => ({ order_id, to_status, created_at: `2026-03-10T10:00:0${n}Z` });
  it("each order once under its last outcome", () => {
    expect(countDelivery([r("a", "returned", 1), r("a", "delivered", 2), r("b", "returned", 3)])).toEqual({ delivered: 1, returned: 1 });
  });
  it("delivered then returning same day is not counted", () => {
    expect(countDelivery([r("a", "delivered", 1), r("a", "returning", 2)])).toEqual({ delivered: 0, returned: 0 });
  });
  it("equal created_at rows resolve by order (tie)", () => {
    const at = "2026-03-10T10:00:00Z";
    const row = (to_status: string) => ({ order_id: "a", to_status, created_at: at });
    expect(countDelivery([row("returned"), row("delivered")])).toEqual({ delivered: 1, returned: 0 });
  });
});
