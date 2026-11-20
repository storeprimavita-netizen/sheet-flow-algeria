import { describe, expect, test } from "vitest";

import { parseViewConfig } from "@/lib/order-views";
import { applyOrderConfig, orderSort } from "./order-query";

function recorder() {
  const calls: string[] = [];
  const q = {
    eq: (c: string, v: string | number | boolean) => (calls.push(`eq:${c}=${v}`), q),
    in: (c: string, v: readonly string[]) => (calls.push(`in:${c}=${v.join("|")}`), q),
    or: (f: string) => (calls.push(`or:${f}`), q),
    gte: (c: string, v: string) => (calls.push(`gte:${c}=${v}`), q),
    lte: (c: string, v: string) => (calls.push(`lte:${c}=${v}`), q),
  };
  return { q, calls };
}

describe("applyOrderConfig", () => {
  test("text search strips filter-breaking characters", () => {
    const { q, calls } = recorder();
    applyOrderConfig(q, parseViewConfig({ q: "a,b)%c" }));
    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toMatch(/[,)](?!customer_phone|order_number)/);
    expect(calls[0]).toBe("or:customer_name.ilike.%a b c%,customer_phone.ilike.%a b c%,order_number.ilike.%a b c%");
  });
  test("agent is a validated uuid; junk adds no filter", () => {
    const { q, calls } = recorder();
    applyOrderConfig(q, parseViewConfig({ agent: "1),or(id.neq.0" }));
    expect(calls).toEqual([]);
  });
  test("numeric search: short = running number, long also matches phone", () => {
    let r = recorder();
    applyOrderConfig(r.q, parseViewConfig({ q: "#42" }));
    expect(r.calls).toEqual(["eq:order_seq=42"]);
    r = recorder();
    applyOrderConfig(r.q, parseViewConfig({ q: "0550123456" }));
    expect(r.calls[0]).toContain("customer_phone.ilike.%0550123456%");
  });
  test("dates and statuses", () => {
    const { q, calls } = recorder();
    applyOrderConfig(q, parseViewConfig({ confirmation_status: ["no_answer"], to: "2026-03-01", duplicates: "1" }));
    expect(calls).toEqual(["in:confirmation_status=no_answer", "eq:is_duplicate_suspect=true", "lte:placed_at=2026-03-01T23:59:59"]);
  });
  test("unknown sort falls back to newest first", () => {
    expect(orderSort(parseViewConfig({ sort: "customer_phone" }))).toEqual({ column: "created_at", ascending: false });
    expect(orderSort(parseViewConfig({ sort: "order_seq", dir: "desc" }))).toEqual({ column: "order_seq", ascending: false });
  });
});
