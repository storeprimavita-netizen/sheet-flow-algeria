VERDICT: FIX

## Summary
Round 1, diff `v3...v3-PRICE-3` at 9bbfcd7. ui-reviewer (browser) + qa-reviewer (numbers of the Real column; added by the coordinator because the task shows money). 2 high, 3 medium, 7 low.
Findings Q1 and Q3 need a DECISIONS row before the fix (which delivery rate the Real column uses; what the USD figure means against D45).
(The verify step ended before its reviewers; the coordinator assembled this file from their two reports, unedited in substance.)

## Findings

### High
- **U1 · page-wide horizontal overflow at 390 px** · `src/app/(app)/app/products/[id]/pricing/pricing-results.tsx:~121`. The `sr-only` hint span sits inside the `<th>`; `sr-only` is `position:absolute` and nothing in the table is positioned, so it is placed against the page. Measured: `documentElement.scrollWidth` 677 on a 390 px viewport, 390 with the span hidden. In AR at 390 px the mobile sidebar drawer is left half-open over the table and the page is unusable (`jupe-ar-light-390.png` vs `jupe-ar-light-390-srhidden.png`). Regression. Fix: `relative` on the scroll wrapper, or drop the span and use `aria-label` / `aria-describedby` on the chip or `<th>`.
- **Q1 · the Real delivery % is pulled down by orders still in flight, without the Preliminary chip** · `src/lib/pricing-real.ts:24`, SQL `00031:102`. `delivered_of_confirmed` divides by every confirmed order, resolved or not. The SQL matured flag counts unresolved orders twice (`U <= 0.2*(C+U)` with U already inside C), so up to 25% of confirmed orders can be in flight while matured is true. Example: 100 confirmed, 25 in flight, 60 delivered, 15 returned → d = 0.60, no chip; resolved rate 0.80; orders needed 33% too high, returns line 2.7× too high. Local data (run): top products show d = 0.50 while `delivery` = 0.80. Spec § Real says "matured cohorts only". Fix belongs in SQL (cap the cohort at today − N days, or a resolved-only delivered/confirmed metric), never in TS. Milder, same shape: `of_received` has orders waiting for confirmation in its denominator. **Needs a decision** (KPI contract D4, D46–D48).

### Medium
- **Q2 · the table never shows the actual confirmation %, delivery % or ad cost per order** · `pricing-results.tsx:20-54`. Spec line 98 and the brief's goal list them. Also the brief's "red when Real is below" break-even rule is not built (`breakEvenState` returns value / missing / impossible only).
- **Q3 · the USD figure is not real USD** · `pricing-real.ts:20`. Ad spend in DZD is booked at each row's own rate (local: EUR at 260) and divided by `parallelRate` (255): €10 per order shows as "$10.20"; Finance shows the same spend as 2600/240 = $10.83 under D45. DZD lines are right. Fix: label it as DZD ÷ rate, or a DECISIONS row that departs from D45. **Needs a decision.**
- **U2 · the Preliminary hint is mouse-only** · same file ~121. A native `title` on a non-focusable span (`tabIndex -1`); keyboard and touch never see it; the column's accessible name becomes "RealPreliminaryFew decided orders…". Fix: project Tooltip/Popover on a focusable chip button, long text in `aria-describedby`.

### Low
- Q4 `pricing-real.ts:33` ignores the RPC `error`: a failed `kpi_summary` shows "No orders yet" instead of an error state.
- Q5 `pricing-calculator.tsx:234` sale price 3961 vs break-even 3961.4 reads "below break-even (3 961 DA)"; show the break-even with `Math.ceil`.
- Q6 `pnl_lines` ad spend starts at the workspace's first order date, so spend logged before that day is dropped (window ≠ order set).
- Q7 the whole Kpi object (P&L, waterfall, cash) goes into the client payload; the page is admin-only, so data minimisation, not a leak.
- U3 group header rows (`colSpan={real ? 5 : 4}`): at 390 px the ADS / COST / PRICE / PROFIT labels disappear when scrolled to Real (`jupe-en-dark-390-scrolled.png`); Real is ~316 px of scrolling away (table 42rem). Inner sticky span for the label, or a narrower label column.
- U4 no visual divider between Real and the three scenario columns.

## Checked and holding
- Rates pass through from SQL, not re-derived in TS; maturity from the SQL flags, no new constant (read).
- Zero received → null and "—"; zero ad spend → 0; negative / NaN / zero rate → null (read + tests). `realScenarioInput` uses the same set and product filter as the KPI (read).
- `requireAdmin` guards the page (read); an agent's `kpi_summary` has no money keys (run).
- Badge: strict `<` and null cases (tests run); the benz test checks the spec's 3,885 total cost. Unit tests 36/36.
- Browser: Real is the 4th column in EN and AR (far left in RTL); tabular, thousands-separated DZD; Real and Preliminary chips and the danger badge use theme tokens and read in both themes (badge figure 4 574 DA); sticky first column opaque; no hardcoded colors.

## Missing tests
- In-flight bias in `delivered_of_confirmed` (Q1). Missing `ad_spend_dzd` key; `of_received` = 0; `delivered_of_confirmed` null while received > 0.

## Not reviewed
- No-orders state ("—" + "No orders yet"), the matured (no chip) state and the badge-absent state: the seed has no product for them / not opened.
- AR light 1280, 390 px dark AR, 390 px EN light. Tooltip keyboard behaviour judged from the DOM only.
- The live RLS suite and the gate were not run by the reviewers.
- Screenshots: `docs/design/audit/PRICE-3/`.
