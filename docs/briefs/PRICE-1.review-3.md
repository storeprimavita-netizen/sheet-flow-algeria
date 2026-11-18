VERDICT: ESCALATE

## Summary
Review 3 of the PRICE-1 diff by qa-reviewer. 42/42 PRICE-1 tests pass and `scripts/gate.sh` reports GATE OK. All 30 benz cells, exact price 5491.48 and markup mode 4400/5200/6000 match PRICE.md, D50 and D51.
All review-1 findings are fixed. Review-2 #1 is fixed in only one direction, and #2 and #3 are partly fixed.
Two medium findings are still open. This is round 3 with no PASS, so the rule escalates it to the owner.
The math is right. What is left is edge-case input validation. Each fix is a few lines and needs no owner decision except the markup cap value (#3, can go through /decide).

## Findings (ranked)

1. **MEDIUM: a share of 100% breaks the whole calculation.** `src/lib/pricing-v2.ts:261`
   - Cause: `frac()` requires `x < 1`, so share 1 is rejected.
   - Failure: `computeAll` with settings `{share: 1}` on benz gives `platformMonthly` null. Total cost becomes null, then every price becomes null.
   - Why it matters: a store with a single product (share 1) is common in COD.
   - Fix: check share against [0, 1]. Keep `< 1` only for platformPct and deadPct, where it guards the `1 - k` denominator.
   - Test: share 1 gives a platform monthly line of 328.66.

2. **MEDIUM: a target value with no mode still mixes the two modes.** `src/lib/pricing-v2.ts:177-178`
   - Cause: `mode` falls back to the base mode while `value` comes from the override.
   - Failure, markup base: workspace `{mode:"markup", value:0.65}` with product override `{target:{value:2000}}` gives a recommended price of 3,702,100 DZD.
   - Failure, profit base: defaults with product override `{target:{value:0.65}}` give 4,000 DZD, using a target profit of 0.65 DZD. The price looks believable but is wrong.
   - The test at `src/lib/pricing-v2.test.ts:258` pins the value-only merge as valid.
   - Fix: accept `ot.value` only when `ot.mode` is a valid mode. Otherwise keep the base target whole, or set the value to null.
   - Tests: a value-only override over a base with the other mode, in both directions.

3. **LOW: markup has no upper limit, and a test pins the bad value.** `src/lib/pricing-v2.ts:269`, `src/lib/pricing-v2.test.ts:267`
   - Failure: markup 65 (meant as 65%) is read as 6500% and gives a recommended price of 124,200. The test asserts `not.toBeNull()`.
   - Fix: cap markup in markup mode (for example ≤ 10) and return null above it. The cap value goes through /decide.

4. **LOW: the -0 test asserts the bug it is named after.** `src/lib/pricing-v2.test.ts:269-270`
   - Failure: the test is called "null, never -0" but asserts that `applyRounding(-0.5, "up100")` is `-0`. Also `applyRounding(0, "charm99")` returns 99.
   - Scope: the engine never hits this (exactPrice > 0 is guarded), but `applyRounding` is exported.
   - Fix: return null when `x <= 0`, and assert null in the test.

5. **LOW: invalid prices passed to `computeScenario` are not rejected.** `src/lib/pricing-v2.ts:310-311`
   - Failure: an explicit `defaultPrice` of -100 is used as P (margin 39.8). PRICE-3 calls `computeScenario` directly.
   - Failure: `applyRounding(40, "nearest100")` returns 0, which becomes P = 0 for best and worst.
   - Fix: the fallback price must be > 0, otherwise null.

6. **LOW: `resolveAdCosts(-1)` returns `medium: -1`.** `src/lib/pricing-v2.ts:194`
   - Failure: best and worst come back null, but medium keeps the negative value.
   - Type: `PricingProduct.adCostUsd.medium` is still typed `number` at `:74`. Review-2 #4 asked for `number | null`, and the test casts with `null as unknown as number`.
   - Fix: treat a medium ad cost below 0 as null, and change the type to `number | null`.

Contract note for PRICE-2 (not a bug): a break-even of null means both "not possible" and "missing input". The UI must check that `profitPerPiece` is non-null before showing the spec's "Not possible" label.

## Missing tests
- share = 1 (#1).
- A value-only target override over a base with the other mode, in both directions (#2).
- Markup above the cap (#3).
- `applyRounding` with exact ≤ 0 in every mode (#4).
- nearest rounding down to 0, and a negative `defaultPrice` (#5).
- k just below 1 (platformPct 0.5176 gives 59,239,400; correct, but not pinned).
- charm990 near the ending boundary (5990.004 gives 5990).

## Owner
- Round 3 without PASS. Suggested path: allow one more FIX round for #1 and #2 (plus the cheap lows).
- Settle the markup cap value (#3) through /decide.
