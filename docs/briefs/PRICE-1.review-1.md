VERDICT: FIX

## Summary
Reviewer: qa-reviewer (risk high, surface none). Diff `git diff v3...v3-PRICE-1`.
Tests 29/29 pass, `tsc --noEmit` clean, no import of `pricing.ts`. All 30 pinned benz cells match the spec, and the medium column was recomputed by hand (total 3885.39, exact 5491.48, profit at 4500 = 527.68).
Formulas, break-evens, D51 markup mode and rounding modes are correct. There are 3 medium findings, all about null/empty handling at the edges. No high findings. No owner decision is needed (#3 can be settled by /decide).

## Findings

### 1. Medium: a null medium recommended price does not stay null for best/worst
- **Where:** `src/lib/pricing-v2.ts:270` (`defaultPrice ?? recommendedPrice`).
- **Failure:** take `overrides:{confirmPct:{medium:0}}` with no final price. Medium recommended = null, but best then uses its own price P = 4700 (profit 1546.56) and worst uses P = 6300. The spec says an empty final price means the MEDIUM recommended price, and review-0 #4 required "medium recommended null -> default P null". So best/worst show believable profits that are wrong.
- **Fix:** use a scenario's own `recommendedPrice` only when the `defaultPrice` argument is omitted (`undefined`). An explicit `null` stays `null`. Add a test.

### 2. Medium: `resolveAdCosts` does not check that the medium ad cost is finite
- **Where:** `src/lib/pricing-v2.ts:173-183`.
- **Failure 1:** `adCostUsd:{medium:null}` (a nullable column in PRICE-2) gives `null*0.68 = 0`. Best/worst then get ad cost 0, an ads line of 0 and a recommended price of 4100, while medium is null. The numbers look valid but are wrong.
- **Failure 2:** `resolveAdCosts(NaN)` returns `{NaN, NaN, NaN}`, so an exported function returns NaN.
- **Fix:** if `!fin(medium)`, best/worst are null unless they were typed, and medium is null. Return type becomes `number | null`.

### 3. Medium: final price 0 does not follow the brief
- **Where:** `src/lib/pricing-v2.ts:270`; test `src/lib/pricing-v2.test.ts:78-81`.
- **Failure:** the brief says "P = finalPrice if > 0, else medium recommended". The code turns `finalPrice === 0` into P = null, so the whole "at final price" block becomes null. Negative F (-100) falls back to 5500, so the two invalid inputs are treated differently. In PRICE-2, `Number("") === 0`, so clearing the input would blank the block.
- **Fix:** follow the brief. Any final price that is not finite or not > 0 falls back to the default P. Change the test to show that 0 and empty give the same P, and that -100 does too. If the builder wants 0 to mean "no price", record that through /decide first.

### 4. Low: rounding mode and target mode from overrides are not validated
- **Where:** `src/lib/pricing-v2.ts:161`, `191-213`.
- **Failure:** `overrides:{rounding:"bogus"}` makes `applyRounding` return `undefined` (not null), because the switch has no default case. `target.mode:"foo"` is silently treated as profit mode.
- **Fix:** in `mergeNode`, accept only the allowed values for both. Add a `default` case in `applyRounding` that returns null (or the exact price).

### 5. Low: percentages are never range-checked
- **Failure:** confirm -0.5 gives a recommended price of 2400 and orders needed of -138. deadPct -0.5 gives sellable 75.
- **Fix:** return null downstream when c or d is outside (0,1], or deadPct is outside [0,1).

### 6. Low: `computeAll` uses the workspace settings as the merge base
- **Failure:** if the PRICE-2 jsonb is missing a nested key, it throws a `TypeError` (confirmed).
- **Fix:** merge in this order: `DEFAULT_PRICING_SETTINGS`, then workspace, then product overrides. Or put this requirement in a doc comment for PRICE-2.

### 7. Low: the NaN test does nothing
- **Where:** `src/lib/pricing-v2.test.ts:126-129`.
- **Failure:** `JSON.stringify` turns NaN/Infinity into `null`, so `includes("NaN")` is never true.
- **Fix:** walk the result recursively and assert that every number leaf is `null` or `Number.isFinite`.

### 8. Low: `EMPTY_BREAK_EVEN` is one shared object
- **Where:** `src/lib/pricing-v2.ts:218`, `:310`.
- **Failure:** every result returns the same object, so a caller that changes it changes all results.
- **Fix:** return a fresh copy each time.

## Missing tests
- Medium recommended null leads to best/worst P null (#1).
- Ad cost null or NaN, and best/worst typed as 0 (#2).
- Final price 0, empty and negative (#3).
- Invalid rounding or mode strings in overrides (#4).
- Markup mode with no product cost gives target null (D51 "—").
- k exactly 1 (`platformPct = 132/255`) gives a recommended price of null.
- A charm price already on the ending (5900 stays 5900).
- `minDelivery` is null when its denominator is ≤ 0.
- A pin for the native preset's recommended price.
- c or d > 1.
- A recursive NaN/Infinity check (#7).
