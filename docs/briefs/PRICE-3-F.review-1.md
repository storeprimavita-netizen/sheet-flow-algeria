VERDICT: FIX

## Summary
Helpers, footer derivation and the both-zero line follow the brief; 102 pricing tests pass (ui-reviewer ran vitest).
Two medium bugs in the new ad = 0, c = 0 branch: Real can show a negative profit while not being flagged as losing, and
maxAdCostUsd draws a 100%-confirmation value when real confirmation is 0%. The edge-case screens from the brief were
not captured by the builder or the reviewer (only normal data, AR light, 1280 px).

## Findings

1. **Medium, `src/app/(app)/app/products/[id]/pricing/pricing-results.tsx:138`.** `realLosing(..., real.result.profitPerPiece, realAd)`.
   With ad = 0 and c = 0, `realZeroRate` is now false, and `real.result.profitPerPiece` is null (the engine rejects c = 0, so cd = null, the ads line = null, totalCost = null).
   The Real profit cell is drawn from `rateOne` (mode "alt").
   Failure: final price below cost, ad 0, c 0, d 0.6. The Real profit cell shows a negative DZD amount, but Real is missing from the "losing" banner, and the break-even cells get no red "below" styling.
   The test at `pricing-form.test.ts` (ad 0, c 0, d 0.6) calls `realLosing` with `real.rateOne.profitPerPiece`, which is not what the component passes, and only covers a positive profit.
   Fix: pass the profit that is actually drawn (`realCellState(mode, real, profitRow).value`, or rateOne's profit when the profit row is "alt"). Add a test with a negative alt profit that expects `realLoses === true`.

2. **Medium, `src/lib/pricing-form.ts` `realZeroRowMode` (`cDrops` branch).** With ad = 0, every row except `AD_TOTAL_ROWS` is "alt", and that includes `maxAdCostUsd`.
   The engine computes `maxAdCostUsd = room * c * d / B`, so c does not drop out of this row.
   Failure: ad 0, c 0, d 0.6. The Real "max ad cost" cell shows a positive USD amount computed at 100% confirmation, while real confirmation is 0%, so any ad spend is a pure loss. The number is wrong and invites spending.
   Fix: treat `maxAdCostUsd` as c-dependent (add it to the "impossible" list beside the ad-total rows), and add it to the test rows with an expected state.
   Also check `adCostPerDeliveredUsd` (it is 0/0 at c = 0) and decide between "alt" (0) and "impossible". Write the choice in the doc comment.

3. **Medium (verification gap), brief "Screens" section.** No screenshots exist for c=0 ad=0, d=0, both 0 (footer line), or c=0 with d null. None exist in dark theme, EN, or at 390 px either.
   AGENTS.md requires the screenshot self-critique for every UI task. The only capture is the reviewer's `docs/design/audit/PRICE-3-F/normal-1280.png` (AR, light).
   Fix: seed the edge cases locally (then `db reset`), screenshot every case in both themes, EN + AR, at 1280 and 390 px, and note the results in PROGRESS.md.

4. **Low, `pricing-results.tsx:254`.** The `v !== 0` guard drops the red "below" styling for any break-even of exactly 0, not only in the ad = 0 case.
   Fix: key the guard on `mode === "alt"` (or on `realAd === 0`).

5. **Low, `pricing-form.test.ts` ("c 0 with d null").** The test filters `ordersNeeded` out of the rows before asserting `anyRealImpossible === false`, which weakens the check. That row resolves to "normal"/missing, so the filter should not be needed. Remove it.

6. **Low, `pricing-results.tsx:148`.** `bothZero` is inline JSX logic and has no pure test. Extract it as a helper next to `anyRealImpossible` and test it: false when ad = 0, true when ad > 0 or ad is null.

7. **Low, UX (carried over from review-4 L5).** At 390 px the Real column is still off-screen. This is not in this brief's scope; keep it tracked.

## Missing tests
- ad 0, c 0, d > 0 with a negative drawn profit: Real is flagged as losing (finding 1).
- `maxAdCostUsd` and `adCostPerDeliveredUsd` state for ad 0, c 0 (finding 2).
- `bothZero` helper truth table (finding 6).
- Value plus state per Real row for d=0, c=0 and both 0, covering the full GROUPS row set rather than the six-row subset.
