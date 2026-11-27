import { describe, expect, test } from "vitest";

import {
  algiersToday, canReverse, dzdTotal, isLowBalance, needsConversion, quoteTransfer, rateFromAmounts,
  transferAgrees, type LegacySource,
} from "@/lib/ledger";

describe("transfers", () => {
  test("transfer pair satisfies the DB rate check both directions", () => {
    for (const rate of [240, 251.37, 0.12345678, 133.33333333, 25000.5]) {
      for (const out of [1, 0.1, 480, 1234.57, 999999.99]) {
        for (const from of ["DZD", "USDT"] as const) {
          const q = quoteTransfer(from, out, rate);
          if (q === null) {
            // only possible when the received side rounds to nothing
            expect(from === "DZD" ? out / rate : out * rate).toBeLessThan(0.01);
            continue;
          }
          expect(transferAgrees(from, out, q.amountIn, q.rate)).toBe(true);
        }
      }
    }
    // float drift: 0.1 * 240.3 = 24.030000000000005, 1.005 * 100 = 100.49999999999999
    expect(quoteTransfer("USDT", 0.1, 240.3)).toEqual({ amountIn: 24.03, rate: 240.3 });
    expect(quoteTransfer("USDT", 1.005, 100)).toEqual({ amountIn: 100.5, rate: 100 });
    expect(quoteTransfer("DZD", 480, 240)).toEqual({ amountIn: 2, rate: 240 });
    expect(transferAgrees("DZD", 480, 2, 241)).toBe(false);
    expect(quoteTransfer("DZD", 0, 240)).toBeNull();
  });

  test("editing amount in recomputes the rate", () => {
    expect(rateFromAmounts("DZD", 1000, 4)).toBe(250);
    expect(rateFromAmounts("USDT", 4, 1000)).toBe(250);
    const rate = rateFromAmounts("DZD", 1000, 3)!;
    expect(rate).toBe(333.33333333);
    expect(transferAgrees("DZD", 1000, 3, rate)).toBe(true);
    expect(rateFromAmounts("DZD", 1000, 0)).toBeNull();
  });
});

test("total is null without a USDT rate", () => {
  expect(dzdTotal({ zr: 10, dzd: 20, usdt: 1 }, null)).toBeNull();
  expect(dzdTotal({ zr: -10.5, dzd: 20.25, usdt: 1.5 }, 240)).toBe(369.75);
});

const source = (over: Partial<LegacySource>): LegacySource => ({
  source_key: "k", source_type: "opening", amount: 10, currency: "DZD", occurred_on: "2026-01-01",
  direction: "in", fx_rate: null, amount_dzd: null, direct_debit_posting: false, ...over,
});

test("needsConversion matches the SQL rule", () => {
  expect(needsConversion(source({}), "dzd")).toBe(false);
  expect(needsConversion(source({}), "zr")).toBe(false);
  expect(needsConversion(source({}), "usdt")).toBe(true);
  expect(needsConversion(source({ currency: "USD" }), "dzd")).toBe(true);
  expect(needsConversion(source({ currency: "USD", amount: 0 }), "dzd")).toBe(false);
  const debit = source({ source_type: "expense", currency: "USD", fx_rate: 200, amount_dzd: 2000 });
  expect(needsConversion(debit, "dzd")).toBe(false);
  expect(needsConversion(debit, "usdt")).toBe(true);
  // an implicit rate of 1 is not evidence of a conversion
  expect(needsConversion({ ...debit, fx_rate: 1, amount_dzd: 10 }, "dzd")).toBe(true);
  // top-ups never carry a rate
  expect(needsConversion({ ...debit, source_type: "topup" }, "dzd")).toBe(true);
});

test("linked, legacy and reversal rows cannot be reversed", () => {
  const entry = { id: "a", expense_id: null, ad_spend_id: null, legacy_mapping_id: null, reverses_entry_id: null };
  const none = new Set<string>();
  expect(canReverse(entry, none)).toBe(true);
  for (const key of ["expense_id", "ad_spend_id", "legacy_mapping_id", "reverses_entry_id"] as const) {
    expect(canReverse({ ...entry, [key]: "x" }, none)).toBe(false);
  }
  expect(canReverse(entry, new Set(["a"]))).toBe(false);
});

test("threshold 0 never warns", () => {
  expect(isLowBalance(-5, 0)).toBe(false);
  expect(isLowBalance(5, 5)).toBe(true);
});

test("dates are Algiers days", () => {
  expect(algiersToday(new Date("2026-03-01T23:30:00Z"))).toBe("2026-03-02");
});
