import { describe, expect, it } from "vitest";

import { parseOrderSeqQuery, sanitizeOrderTextQuery } from "./order-search";

describe("parseOrderSeqQuery", () => {
  it("accepts plain, hash and leading zeros", () => {
    expect(parseOrderSeqQuery("42")).toBe(42);
    expect(parseOrderSeqQuery("#0042")).toBe(42);
    expect(parseOrderSeqQuery(" 0001 ")).toBe(1);
  });
  it("rejects non numeric and out of range", () => {
    expect(parseOrderSeqQuery("ahmed")).toBeNull();
    expect(parseOrderSeqQuery("#")).toBeNull();
    expect(parseOrderSeqQuery("##1")).toBeNull();
    expect(parseOrderSeqQuery("0555 12 34 56")).toBeNull();
    expect(parseOrderSeqQuery("1234567890")).toBeNull();
  });
});

describe("sanitizeOrderTextQuery", () => {
  it("strips filter syntax", () => {
    expect(sanitizeOrderTextQuery("a,b)(c%")).toBe("a b c");
  });
});
