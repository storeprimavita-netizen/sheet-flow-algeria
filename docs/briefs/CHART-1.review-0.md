VERDICT: FIX

## Summary
Brief review (no code yet). The direction is sound (hand-drawn SVG, series built in SQL, no new dependency). But the SQL contract as written breaks D64: agents would get counts and rates. The "daily money = pnl_lines" invariant cannot hold as specified, because of how fixed fees are shared, rounding and default dates. Drill-through and the keyboard/ARIA model are missing. The migration number clashes with VAR-1, and an existing guard test breaks when the waterfall file is deleted.
Reviewers: qa-reviewer (SQL/RLS, local DB checked live) and ui-reviewer (brief only, app not run).

## Findings (ranked)

### High
1. **The agent gating breaks D64.** See brief §Migration 1-3 and "Real code found", last bullet.
   - `kpi_daily` leaves out only the money keys, so agents still get daily counts and rates.
   - The live `o_sel` policy shows agents only part of the orders, so those rates come from a partial set. D64 says the stats RPCs return nothing unless `is_admin()`.
   - Nothing says who may call `kpi_by_weekday_hour` or `kpi_by_product`.
   - Both pages already sit behind `AdminGuardLayout` (`statistics/layout.tsx`, `dashboard/page.tsx:18`), so the "agents get no money series" UI work is moot.
   - **Fix:** all three RPCs return null or no rows unless `public.is_admin()`. Drop the agent UI branch. Test live with agent and anon sessions.
2. **The "sum of daily money = `pnl_lines`" check fails as specified.** See §Migration 1.
   - **Fixed fees.** `pnl_lines` (00031:302) computes `round(monthly*days/30*share,2)`. The brief has "monthly/30 per day" with no product `share`, so a product filter gives full fixed fees. Use `fixed_share`, as in 00031:439.
   - **Rounding.** `pnl_lines` rounds once. Example: 10000/month over 7 days is 2333.33 in `pnl_lines`, but summing per day does not give that. Round per day and put the remainder on the last day, so the zero-tolerance test can hold.
   - **Default dates.** With no dates, `pnl_lines` runs from the first order in the workspace to today. Use the same bounds, ideally read from its `period_from` and `period_to`. Reject `p_from > p_to`: `pnl_lines` still charges one day there while the day list is empty.
   - **Filters.** Ads and expenses cannot follow a wilaya or source filter. Leave the money keys out when non-product `p_filters` are set.
3. **Daily rates would copy `kpi_rates`' logic.** See §Migration 1-2.
   - "Via `kpi_metric`" invites rewriting the decided, after-pickup, swap and replacement denominators.
   - **Fix:** call `kpi_rates` once per day, weekday or hour group, the way `kpi_by_wilaya` does (00061:269). Take counts from its `counts`, not from `orders_received` in `pnl_lines`, which includes replacements.
   - Never average daily rates to get a period figure.
   - A day with no rate is a gap in the line, not 0%. Mark days whose figures are not final yet: show them as immature or dashed.
4. **Drill-through is missing** (cod-ui-polish step 6, `section-checklists.md:69`).
   - **Fix:** each bar, donut slice and line point links to the orders list with the matching filters, reusing `ordersQs`/`statsDrillFilters`.
   - A tooltip is not the only way to see a value: give 44px touch targets, or put a "View orders" link in the tooltip.
   - Add an href test.

### Medium
5. **Migration 00068 is taken.** `origin/v3-VAR-1` already has `00068_variant_options_swatches.sql`. Use 00069, or renumber whichever branch merges second.
6. **The dashboard guard test breaks.** `dashboard-kpi-source.test.ts:38` asserts on `pnl-waterfall.tsx`, which this brief deletes, and tests must not be deleted. Name the replacement assertion and add `money-chart.tsx` and `components/charts/*` to the files the test checks.
7. **A daily money series already exists.** `dashboard_stats.daily` (00031:531-569) has `revenue_dzd`/`invested_dzd` and nothing reads it. Adding `kpi_daily` would leave two daily money formulas. Drop `daily` from `dashboard_stats` in the new migration, or rebuild it on `kpi_daily`.
8. **Do not reuse `pnl_by_product`.** It takes no `p_product`/`p_filters`, so the product bars would ignore the filters, and it runs `kpi_lines`+`pnl_lines` once per product. Write `kpi_by_product` on the `kpi_by_wilaya` pattern.
9. **The outcome donut has no SQL source.** The `kpi_rates` counts overlap: delivered includes replacements, and swaps overlap too. Define in SQL at most 5 categories that add up to `received`, coloured with status tokens from `statuses.ts`. Doing the split in TS breaks D4.
10. **Keyboard and ARIA model** (§Files `chart-frame`).
    - `role="img"` hides the points from assistive tech, yet the brief also wants focusable points. Choose `role="group"` with a labelled roving-tabindex point list.
    - Keys: Left/Right moves and flips in RTL, Up/Down switches series, Home/End jump to the ends, Enter drills through, Escape closes the tooltip.
    - The focused value is announced, and the focus ring uses a token.
11. **Touch tooltip.** Tap pins it; tapping elsewhere or Escape dismisses it. Set `touch-action: pan-y` on the plot so the page still scrolls. At 390px the tooltip flips instead of clipping.
12. **Colour and contrast.**
    - The 3-series money chart needs a dash plus marker per series (solid+circle, dashed+square, dotted+diamond). Move this from edge cases to the Done list.
    - Donut and stacked-bar legends carry DZD and % values, with a gap between segments.
    - Check `--chart-*` against `--card` at 3:1 in both themes. The light-theme `chart-3` amber (`globals.css:176-179`) is suspect.
13. **RTL specifics.**
    - Time runs oldest-at-right, the Y axis sits on the right, and horizontal bars grow leftward.
    - Latin product names in labels are wrapped in `bdi`, and text is never mirrored.
    - Weekday order (does the week start on Saturday?) is a locale choice to state.
14. **State and layout.**
    - Each chart gets its own error boundary that retries with `router.refresh()`, and a skeleton with the chart's real height.
    - Each chart gets its own empty copy with an action. When there are zero orders, show a single page-level empty state, not 8 empty charts.
    - Group Statistics into sections: Volume and conversion / Outcomes / Where / When.
    - Say whether `SeasonCompare`/`WilayaSection` stay.
    - Give the money chart's mobile order and minimum height (about 220px).
15. **Table toggle.** A button with `aria-pressed`, and a real `<table>` with `<caption>` and `scope`. Numbers are tabular and LTR-isolated. Tables longer than 90 rows scroll with a sticky header.
16. **Recent days look like a loss.** Revenue counts by order date and ads by spend date, so the right edge always dips. Draw immature days dashed and add an owner-visible note.

### Low
17. Extract weekday and hour from `(ts at time zone 'Africa/Algiers')`. The session time zone is UTC.
18. Sorting wilayas and products "worst first" puts tiny wilayas on top. Apply a minimum count or maturity floor.
19. Cap the `generate_series` range at 366 days.
20. Ads in the cost bar and tooltips show USD first (D45).
21. Axis labels use compact DZD; the tooltip and table show full, thousands-separated values. Ticks always include 0 when profit goes negative.
22. "Max 4 cards per row" becomes a testable grid rule, `lg:grid-cols-4`.
23. No draw animation, or honour `prefers-reduced-motion`.
24. Fix the stale "migration –" entry in the MASTER_PLAN row.
25. The cod-ui-polish `components.md:3` mention of recharts conflicts with D3. D3 wins; note it.

## Missing tests
- Live SQL: agent and anon callers get nothing from all 3 RPCs.
- Admin daily sum equals `pnl_lines` in three cases: no dates, a product filter (share), and a 7-day non-integer fixed fee.
- `p_from > p_to` is rejected.
- An order at 23:30 UTC lands on the next day, hour 0, next weekday.
- Daily rates re-aggregate to `kpi_rates`, and swaps and replacements don't shift the counts.
- The donut adds up to `received`, with at most 5 slices and "Other" summing correctly.
- chart-math ticks: a negative or zero domain, a single point, and thinning beyond 90 days.
- Drill-through href. The first point's x in RTL is greater than the last's. The table shows the same numbers as the plot.
- `dashboard-kpi-source` replacement assertion. `check-i18n` parity.

## Missing screenshots
Dashboard and Statistics at 1280 and 390 px, in dark and light, EN and AR. Also:
- a pinned touch tooltip and the keyboard focus ring;
- the table view;
- empty, loading and error states for each chart type;
- negative profit;
- a single-day period;
- tick thinning beyond 90 days.

## Owner points (not blocking)
Totals are counted by order date, and recent days are drawn dashed (#16). The 00068 number clashes with VAR-1 (#5).
