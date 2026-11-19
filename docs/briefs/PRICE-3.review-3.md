VERDICT: ESCALATE

## Summary
Round 3 fixes review-2's findings 2, 3, 5 and 7. Finding 1 (0% rate shown as "Missing input") and finding 4 (tap targets) are only partly fixed, and finding 6 (brief update) is partly fixed per qa-reviewer. Targeted unit tests pass (90 in pricing-real, pricing-form, pricing-v2); the full gate was not re-run by the reviewers.
For the first time the 0% case was checked in the browser (local DB, Veste Sarah, 4 delivered flipped to returned, then reverted). It shows one medium bug, found by both reviewers: "Final price used" and the zero rate's own break-even show "Not possible". The fix is mechanical and needs no new decision. This is ESCALATE only because n = 3 without a PASS (loop rule), not because an owner decision is needed.
Reviewers: qa-reviewer (numbers) and ui-reviewer (screens, `docs/design/audit/PRICE-3-r3review/*.png`).

## Review-2 findings, status
1. 0% rate hidden as "Missing input": **partly fixed.** `realZeroRate` / `realLosing` (`src/lib/pricing-form.ts:379-394`) now draw Real cells "Not possible" and add Real to the "loses money" line. The override is too broad (M1, L1).
2. Real ad-cost cell announced without its value: **fixed.** The accessible name is "$10.66 2 718 DA" and the hint is exposed through `aria-describedby`.
3. Ad-cost number out of line: **fixed.** The icon sits at `end-full`, and the number now lines up with the rows above and below (`en-light-390-zero-real-col.png`).
4. Small tap targets, faint focus ring: **partly fixed.** `ring-2` is in place. The triggers are now 36 px tall (Preliminary chip 105×36, ad-cost 58×36), still below the 44 px touch target (L3).
5. Whole `Kpi` sent to the client: **fixed.** `toRealKpiSlice` (`src/lib/pricing-real.ts:15-23`) passes only four fields (`page.tsx:40`).
6. Brief not updated: **partly fixed.** l.25, 38 and 43 are updated. l.7 still lists `ordersReceived` (L2).
7. Hint rounds the rate: **fixed.** Two decimals.

## Findings (ranked)

1. **Medium (M1): with a 0% real rate, "Final price used" and the zero rate's own break-even show "Not possible".** `src/app/(app)/app/products/[id]/pricing/pricing-results.tsx:224`, `realZero && !row.input ? "impossible"`.
   Failure (seen in the browser, AR dark 1280 and EN light 390): Veste Sarah has confirmation 70% and delivery 0%. "Final price used" shows "Not possible", but the engine returns P = 9 900 DA, an input echo that does not depend on any rate. "Minimum delivery rate" also shows "Not possible", but minDelivery does not depend on d: about 44% here, and about 33.8% for benz (c .65, d 0, ad 2.2, P 5 500, cross-checked at d = 0.0001). The footer `notPossibleHint` ("cannot cover the costs at any value of this input") then says something false. The mirror case applies when confirmation = 0 (minConfirmation does not depend on c).
   Fix: move the per-row Real state into a pure helper in `src/lib/pricing-form.ts` and keep the JSX as a lookup.
   - Leave `finalPrice` out of the override.
   - For the zero rate's own break-even row, take the value and the `breakEvenState` from `computeScenario` run with only that rate set to 1, and draw it as "below". This needs no copied formula and no change to the engine's validation.
   - Leave every other dependent row "impossible".

2. **Low (L1): the zero-rate override hides missing inputs.** Same line. `realZero` beats "missing" even when stock cost is NaN (no `product_costs` row) or the parallel rate is invalid. The scenario columns then show "—" while Real shows "Not possible".
   Fix: apply "impossible" only when the engine result with that rate set to 1 is non-null. Otherwise show "missing".

3. **Low (L3): hint triggers are 36 px, under the 44 px touch target.** Preliminary chip and ad-cost trigger. Fix: `min-h-11`, or an invisible hit-area pseudo-element so the row height stays the same.

4. **Low (L4): at 390 px the ad-cost hint popover touches the right viewport edge (x≈779 of 780) and covers the "Total ad spend" cells** (`en-light-390-hint-open.png`). Fix: set `collisionPadding` (about 8) on the popover content.

5. **Low (L2): `docs/briefs/PRICE-3.md:7` still lists `ordersReceived`,** which the loader never returns. Fix: remove it.

Not checked: Escape closing the popovers; EN dark 1280 and AR light screenshots; confirmation = 0 in the browser (same code path).
Note: the browser check flipped and restored statuses on the local DB, which left extra `order_status_history` rows and possibly stock movements. `npx supabase db reset` clears them.

## Missing tests
- A pure per-row Real state helper (including the final-price row), tested for d = 0 and c = 0 against the expected states in M1.
- `realScenarioInput` with `confirmation.value = 0` maps to confirm 0. Only delivery 0 is pinned today.
- A zero rate plus missing stock cost gives "missing", not "impossible" (L1).
- Engine: d = 0 leaves `finalPrice` non-null, and minDelivery equals the value from d = 1 (pins what M1 relies on).
- `toRealKpiSlice` output has no `pnl`, `waterfall` or `net_profit` keys.
