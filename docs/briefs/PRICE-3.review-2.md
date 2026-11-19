VERDICT: FIX

## Summary
Round 2 fixes most of review-1: D67 rates (`confirmation.value` and `delivery.value`, `matured` only when both flags are true), the three rate rows, Real "below" cells driven by the engine's `profitPerPiece < 0`, U1–U4, Q2/Q3/Q5, and Q4 now throws to error.tsx. The gate passes: 638 tests including live RLS, parity, color lint and build.
Two medium findings remain: a real 0% rate shows as "Missing input" and hides the worst-case loss, and screen readers never hear the Real ad-cost value. No owner decision is needed (D52 already defines "impossible"). Reviewers: qa-reviewer (numbers) and ui-reviewer (screens, `docs/design/audit/PRICE-3/r3-*.png`).

## Findings (ranked)

1. **Medium: a real 0% confirmation or delivery rate shows "—" (Missing input) and hides the loss.** In `src/lib/pricing-v2.ts:289`, `inRange` requires `x > 0`, so `c` or `d` = 0 becomes null. The effect shows in `pricing-results.tsx` (~384-393, and `realLoses` ~306).
   Failure: a product with 12 parcels, 0 delivered and 12 returned has `delivery.value = 0`, and its flag can say matured. Running the engine with c = .65, d = 0, ad 2.2 returns null total cost, null profit and four null break-evens. In the UI every Real cell becomes "—" with aria-label "Missing input", and Real is left out of the "loses money in …" line. So the worst possible product gives no warning. The same happens when confirmation is 0%.
   Fix: a pure helper in `src/lib/pricing-form.ts`. When `hasData` and confirm or delivery is exactly 0, draw the dependent Real cells as "impossible" ("Not possible", warning token and icon, as D52 already defines) and count Real as losing. Do not change the engine's validation for the scenario columns.

2. **Medium (a11y): the Real ad-cost cell is announced without its value.** `pricing-results.tsx:106`: the `Hint` trigger has `aria-label={label}`, and that label replaces the button's content (`$19.22` / `4 900 DA`). Screen readers hear only "Ad cost / order (USD), button", while the other three columns announce their values.
   Fix: drop `aria-label` so the content becomes the name and the hint stays in `aria-describedby`, or use `${label}: ${value}`. The Preliminary chip is fine because its visible text is its name.

3. **Low: the Real ad-cost number is out of line with its column.** The info icon sits inside the right-aligned flex, so `$19.22` ends about 18 px before `80%` and `$3,891.18` in the rows above and below (`r3-en-light-390.png`, `r3-ar-dark-1280.png`).
   Fix: move the icon out of the number's alignment box, for example absolutely positioned at `end-full`, or give the other rows a matching gutter.

4. **Low: the hint triggers are small tap targets, and their focus ring is faint.** The Preliminary chip button is 51×20 px and the ad-cost button 65×36 px. The focus ring is `ring-1` at 55% opacity.
   Fix: give the trigger `min-h-9 px-1` (or a pseudo-element hit area) and use `ring-2`, as the project's other focusables do.

5. **Low: Q7 is still open.** `page.tsx:40` passes the whole `Kpi` object (including `pnl`, `waterfall` and `net_profit`) to a client component. The page is admin-only, so this is data minimisation, not a leak.
   Fix: pass only `confirmation`, `delivery`, `counts.received` and `ad_spend_dzd`. Q6 (the SQL window) is also not done and not logged. Add it to plan row P1-1-F at ship, together with D67(9).

6. **Low: the brief is not updated as D67(7) asks.** `docs/briefs/PRICE-3.md:38` still contrasts the parallel rate with "the D45 official-rate display value". l.25 ("docs/DB.md: no change") and l.49 ("No new DECISIONS row needed") are now false. l.7 lists `ordersReceived`, which the loader does not return.
   Fix: update those lines.

7. **Nit: the hint can print a different rate from the one used.** `formatInt(real.rate)` rounds, so a rate of 255.5 shows as "256" while the engine uses 255.5.
   Fix: format with the same precision as the settings field.

## Missing tests
- The Real "below" classification is inline JSX. Extract it to a pure helper and test that profit −1 is below and profit 0 is not.
- Real with `delivery.value = 0` or `confirmation.value = 0` while received > 0 should give "impossible" and Real losing (finding 1).
- `adCostDzd` should still be present when the parallel rate is invalid.

## Not checked
- The ui-reviewer did not re-run 390 px in EN dark or AR light, or EN at 1280 px. It checked EN light and AR dark at 390 px (touch emulation) and AR dark at 1280 px.
- The next round should screenshot the two missing 390 px combinations after the fix.
