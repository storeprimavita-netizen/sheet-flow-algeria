VERDICT: FIX

## Summary
Security holds. Agents get 0 rows and anon gets permission denied from every RPC. All RPCs are security invoker, stable and authenticated-only. Reversed ranges are rejected. Daily money sums equal `pnl_lines` within 366 days. Outcomes sum to received. Live suite 14/14 and unit tests 72/72 pass.
Four medium findings remain. One is a money mismatch on ranges over 366 days. Three are UI/a11y: the tooltip hides the focused point, touch targets are far below 44px, and the dashed "not final" cue is lost on the already-dashed series. Reviewers: qa-reviewer (owasp-security) and ui-reviewer (ran the app, chrome-devtools).

## Findings (ranked)

1. **MEDIUM: the chart total disagrees with the period total on ranges over 366 days.** `supabase/migrations/00069_chart_series_review.sql:35-42`, `src/components/dashboard/money-band.tsx` (`total={formatCurrency(kpi.net_profit)}`), `src/components/dashboard/money-chart.tsx:51`.
   - Failure: `kpi_daily` keeps only the last 366 days. The printed period total comes from `dashboard_stats` over the whole range. Example: `kpi_daily('2024-01-01','2026-11-19')` daily net sums to −1,252,220 while the period total is −3,270,353, so the cumulative line ends far from the number beside it.
   - Scope: the default dashboard view has no dates, so any workspace with more than a year of history hits this. The Statistics orders/day chart is cut the same way with no note.
   - Fix: return the truncation start (`truncated_from`) and show a "showing last 366 days" note. Better, compute the period total for the chart's own window when the range is cut.

2. **MEDIUM: the tooltip covers the focused point and its focus ring.** `src/components/charts/chart-panel.tsx:179-215` (ChartTooltip), `use-chart.ts` `show()`, `line-chart.tsx:130`.
   - Failure: the tooltip is anchored to the top of the full-height hit band. On keyboard focus it sits over the marker and ring, so a sighted keyboard user cannot see which point is focused (screenshot `docs/design/audit/CHART-1/dash-focus-en-light.png`).
   - Fix: anchor the tooltip to the series value's y with a gap and flip it away from the marker, or draw a guide line or marker outside the tooltip.

3. **MEDIUM: touch hit targets are far below the brief's 44px.** `src/components/charts/line-chart.tsx:83-90`.
   - Failure: each band is exactly one pitch wide. On the 93-day money chart that is 18px at 1280 and 6px at 390, and 136 of 139 points are under 44px. A tap cannot reliably hit the intended day.
   - Fix: on touch, snap a tap anywhere in the plot to the nearest index (pointer x to nearest column), or add a horizontal scrub.

4. **MEDIUM: the immature-days cue is unreadable on two of the three money series.** `src/components/dashboard/money-chart.tsx`, `src/components/charts/line-chart.tsx`.
   - Failure: recent days are marked by drawing them dashed. Total costs is already dashed and Net profit is already dotted, so their immature stretch looks the same as the rest. The owner note about right-edge dips only works for Revenue.
   - Fix: mark immature days by shading the region as a band, or by lowering the opacity or lightness of every series there, not by changing the dash.

5. **LOW: orders dated in the future break "daily sum equals pnl_lines".** `00069:30-31,81`.
   - Failure: with no `p_to`, the order set has no upper date limit but the day series stops at today. A future-dated order (an import, for example; no check constraint stops it) counts in `pnl_lines` but in no day.
   - Fix: pass `v_to` to `kpi_order_set`, or end the series at the latest order date.

6. **LOW: `kpi_drill_orders` can throw where it used to return zero rows.** `00069:178,182,184`.
   - Failure: `p_filters - 'weekday'` throws on a non-object input, and `(p_filters->>'weekday')::int` throws on `"abc"`. This breaks the 00061 rule "non-object filter means zero rows, never throws". Only admins can reach it and the UI validates first, so it is a contract break, not a leak.
   - Fix: guard with `jsonb_typeof(p_filters)='object'` and a regex check before the cast.

7. **LOW: a reversed range on the orders drill page now shows an error.** `src/app/(app)/app/orders/all/page.tsx:78-79`.
   - Failure: a reversed `from`/`to` (a hand-edited or shared link) shows "drill failed" instead of an empty list.
   - Fix: swap the dates there, as Dashboard and Statistics already do.

8. **LOW: the weekday drill banner shows the ISO number.** `orders/all/page.tsx:266`.
   - Failure: the banner reads "Weekday 6". This is confusing in AR, where the week shown starts on Saturday.
   - Fix: use the `statistics.charts.weekday.{n}` label.

9. **LOW: Arabic short weekday labels are cut to non-words.** `src/messages/ar.json:1716-1724` (`weekdayShort`).
   - Failure: "اثن", "ثلا", "خمي", "جمع" are not words.
   - Fix: use full names or the standard short forms. The columns are wide enough.

10. **LOW: only `kpi_daily` has the 366-day cap.** The brief says "cap range 366 days" for all RPCs. `kpi_by_weekday_hour`, `kpi_by_product` and `kpi_outcomes` accept any range. They are admin-only and return grouped rows, so the impact is cost only. Fix: apply the same cap or truncation.

11. **LOW: the Table and Cumulative toggles are 32px tall at 390.** Fix: `min-h-11` on mobile.

12. **LOW: the rate lines read as scattered dots on sparse data.** Days with no orders are null, as the brief says ("gap, not 0%"). Fix: add a short legend note ("no orders that day = gap").

Not a defect: the cost bar order (cogs, returns, ads, expenses). D45 governs USD-first *display* of ad money, which is correct ($905 · 217 100 DA), not the bar order.

## Missing tests
- RTL arrow-key flip: in AR, ArrowLeft moves to the next index (`useChartNav`).
- Touch: a tap pins the tooltip and an outside tap or Escape dismisses it (no pointer-type test exists today). Tap-to-nearest-index once finding 3 is fixed.
- The tooltip does not overlap the focused marker. Immature styling is visible on every money series.
- A table with more than 90 rows scrolls with a sticky header.
- Live SQL:
  - weekday/hour drill parity: `kpi_drill_orders('received', {weekday:"7"})` and `{hour:"0"}` equal the matching `kpi_by_weekday_hour` buckets.
  - Isolation between two workspaces for all 4 RPCs, including ad spend and expenses.
  - A future-dated order with no `p_to`: the daily sum still equals `pnl_lines`.
  - Ranges over 366 days and no-date history longer than a year: the total matches the chart window, or the note is present.
  - `kpi_drill_orders` with a non-object or non-numeric weekday filter returns 0 rows, not an error.
- Not seen in a browser: AR light, EN dark, EN 390, and the forced error and skeleton states. Capture them in the next screenshot pass.
