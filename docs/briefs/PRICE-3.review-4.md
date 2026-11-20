VERDICT: PASS

## Summary
Round 4 (b5c852e) fixes review-3's medium M1 and low L1. No high or medium finding is left. Targeted unit tests pass (93 in pricing-form, pricing-v2, pricing-real); the builder reports the full gate as GATE OK (645).
In the browser (local DB, cases made and then cleared with `db reset`), delivery 0%, confirmation 0% and both 0% show the final price, the zero rate's own break-even in red, and "Not possible" only where it is true.
The builder's edge (both rates 0: both own break-even rows "Not possible", only the final price shown) is correct whenever ad cost > 0, and it reads clearly enough.
Reviewers: qa-reviewer (numbers) and ui-reviewer (screens, `docs/design/audit/PRICE-3-r4review/*.png|jpeg`).

## Review-3 findings, status
- M1 (final price and own break-even shown as "Not possible"): **fixed.** `realZeroRowMode` (`src/lib/pricing-form.ts:395-407`) sends `finalPrice` and the zero rate's own break-even to an engine run with only that rate set to 1 (`pricing-calculator.tsx:135-148`). The own break-even is drawn "below" (`pricing-results.tsx:260-266`). Engine check: minDelivery is the same at d = 1 and d = 0.0001, and the same holds for minConfirmation with c. No formula is copied into the page.
- L1 (zero rate hid missing inputs): **fixed.** `rateOneComplete = rateOne.totalCost !== null` (`pricing-results.tsx:227`). When it is false, the cell falls back to `breakEvenState`, which shows "missing".
- L2, L3, L4 (brief l.7, 36 px tap targets, popover touching the edge): not in this diff's scope and not re-checked. They stay open as lows.

## Findings (ranked)
1. **Low: ad cost exactly 0 with c = 0.** `src/lib/pricing-form.ts:403-405`, `pricing-results.tsx:260`.
   - When ad = 0, c drops out of the engine. With c = 0, d = 0.6, ad = 0, Real profit shows "Not possible" and "loses money", but the engine gives 3 706 DA at any c.
   - minConfirmation then shows 0%, drawn red as "below".
   - With c = 0, d = 0, ad = 0, minDelivery shows "Not possible" although the engine gives 4.95%.
   - This needs a product with no ad spend at all and c = 0, which is rare.
   - Fix: when `adCostUsd === 0`, treat c = 0 rows as "alt" (except ordersNeeded and the ad-total rows), or at least don't draw a 0 break-even as "below".
2. **Low: the "not possible" footer can show with no "Not possible" cell.** `pricing-results.tsx:143`, `anyImpossible = realZero || …`.
   - Example: c = 0 and d null (a new product whose orders are all cancelled or unanswered). The L1 path makes every Real cell "—", but `notPossibleHint` still shows.
   - Fix: derive the footer from the drawn modes, e.g. show it only when at least one row's `realZeroRowMode(...) === "impossible"`.
3. **Low: when both rates are 0, nothing on screen says why the cells are "Not possible".** It can be worked out from the 0% / 0% rates and the red loss line.
   - Fix: add one footer line for the both-zero case, e.g. "No orders were confirmed or delivered yet, so Real break-even can't be computed".
   - New copy needs EN/AR parity.
4. **Low: per-cell `src` and state are still chosen in the JSX** (`pricing-results.tsx:230-240`). Review 3 asked for a pure helper with the JSX as a lookup, so the state actually drawn has no unit test. Not a bug.
5. **Low: at 390 px the Real column is off-screen until you swipe,** while the "Below break-even in Real" line is visible at once. This layout is unchanged from earlier rounds. Optional fix: make the Real column sticky, or show it first on narrow screens.

## Missing tests
- `realScenarioInput` with `confirmation.value = 0` maps to confirm 0 (only delivery 0 is pinned, `pricing-real.test.ts:83-86`).
- NaN stock cost gives a null `rateOne.totalCost`, so the cell is "missing" (only `rateOneComplete = false` is tested).
- Engine: d = 0 keeps `finalPrice` non-null, and minDelivery is equal at d = 1 and at a small d (and the same for c).
- `toRealKpiSlice` output has no `pnl`, `waterfall` or `net_profit` keys.
- The drawn value and state per Real row for d = 0, c = 0 and both 0 (today only the mode is tested, `pricing-form.test.ts:268-290`).
