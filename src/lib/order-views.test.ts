import { describe, expect, test } from "vitest";

import {
  CLEARED,
  effectiveConfig,
  isDirty,
  parseUrlConfig,
  parseViewConfig,
  parseViewId,
  serializeConfig,
  viewInputSchema,
} from "./order-views";

const seeds = [
  { confirmation_status: ["wait_for_confirmation"] },
  { confirmation_status: ["no_answer", "closed_phone"] },
  { duplicates: "1" },
];

describe("order views config", () => {
  test("every seed config parses without losing keys", () => {
    for (const s of seeds) expect(parseViewConfig(s)).toEqual(s);
  });
  test("junk keys and values are dropped, valid kept", () => {
    expect(parseViewConfig({ wilaya_code: 99, source: "nope", sort: "evil", agent: "x", from: "2026-02-31x", duplicates: "1", extra: 1 })).toEqual({ duplicates: "1" });
    expect(parseViewConfig("x")).toEqual({});
    expect(parseViewConfig([1])).toEqual({});
  });
  test("injection characters in url q and agent do not survive", () => {
    const a = parseUrlConfig({ agent: "1),or(id.neq.0", q: "a,b)%" });
    expect(a.values.agent).toBeUndefined();
    expect(parseViewConfig({ agent: "x,y", q: "a,b" }).agent).toBeUndefined();
  });
  test("unknown sort is dropped", () => {
    expect(parseUrlConfig({ sort: "customer_phone" }).values.sort).toBeUndefined();
  });
  test("url overrides the view, including the cleared marker", () => {
    const view = parseViewConfig({ confirmation_status: ["no_answer"], duplicates: "1" });
    expect(effectiveConfig(view, { confirmation_status: "cancelled" }).confirmation_status).toEqual(["cancelled"]);
    const e = effectiveConfig(view, { confirmation_status: CLEARED });
    expect(e.confirmation_status).toBeUndefined();
    expect(e.duplicates).toBe("1");
  });
  test("dirty ignores page and status order", () => {
    const view = parseViewConfig({ confirmation_status: ["no_answer", "closed_phone"] });
    expect(isDirty(view, { page: "3" })).toBe(false);
    expect(isDirty(view, { confirmation_status: "closed_phone,no_answer" })).toBe(false);
    expect(isDirty(view, { confirmation_status: "no_answer" })).toBe(true);
    expect(isDirty(view, { source: "manual" })).toBe(true);
  });
  test("serialize round-trips", () => {
    const c = parseViewConfig({ confirmation_status: ["no_answer", "closed_phone"], wilaya_code: 16, q: "ali" });
    expect(parseUrlConfig(Object.fromEntries(serializeConfig(c))).values).toEqual(c);
  });
  test("junk view ids", () => {
    expect(parseViewId("abc")).toBeNull();
    expect(parseViewId(["a"])).toBeNull();
    expect(parseViewId("3F2504E0-4F89-41D3-9A0C-0305E82C3301")).toBe("3f2504e0-4f89-41d3-9a0c-0305e82c3301");
  });
  test("oversize name and emoji are rejected", () => {
    expect(viewInputSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
    expect(viewInputSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(viewInputSchema.safeParse({ name: "ok", emoji: "ab" }).success).toBe(false);
    expect(viewInputSchema.safeParse({ name: "ok", emoji: "x".repeat(20) }).success).toBe(false);
    expect(viewInputSchema.parse({ name: " ok ", emoji: "🔥" })).toEqual({ name: "ok", emoji: "🔥" });
  });
  test("a long q is cut to 80 characters, not dropped", () => {
    expect(parseUrlConfig({ q: "a".repeat(200) }).values.q).toBe("a".repeat(80));
  });
  test("one bad status keeps the valid ones", () => {
    expect(parseUrlConfig({ confirmation_status: "no_answer,bogus" }).values.confirmation_status).toEqual(["no_answer"]);
    expect(parseUrlConfig({ confirmation_status: "bogus" }).values.confirmation_status).toBeUndefined();
  });
});
