VERDICT: ESCALATE

## Summary
Round 3, so no PASS is possible yet (n ≥ 3) and the result is ESCALATE. Security holds. The gate is green: 899 passed, the CHART-1 live suite passed 14/14, agents get 0 rows, anon is denied, and the daily money sum equals pnl.
Review-2 findings #1–#4 are fixed. Review-2 #5–#11 are still open.
There are two medium findings:
- One needs an owner decision: the waterfall still renders on Finance overview.
- One is the 32px toggles on mobile.
Everything else is low. Screenshots: `docs/design/audit/CHART-1/r3-*.png`.

## Findings (ranked)

1. **MEDIUM (owner decision)**: `src/components/dashboard/pnl-waterfall.tsx` still exists, and `src/app/(app)/app/finance/overview/page.tsx:12,116` still renders `PnlWaterfall`.
   - The brief's "Done when" says to delete `pnl-waterfall.tsx`, and D77 removes the waterfall as not understandable. The brief's "Real code" section missed this second use.
   - `buildSteps` and `WaterfallRows` are now dead exports.
   - Owner decides one of two options:
     - (a) Finance gets the h stacked-bar cost breakdown and the file is deleted.
     - (b) Finance keeps the waterfall and the brief is amended.

2. **MEDIUM**: the Table toggle (`src/components/charts/chart-panel.tsx:149`) and the Cumulative toggle (`src/components/dashboard/money-chart.tsx:58`, `money-band.tsx`) are `size="sm"`. That makes them about 32px tall at 390, below the 44px target the brief asks for. This is review-2 #11, still open.
   - Fix: add `min-h-11` below `sm`.

3. **MEDIUM (unverified)**: a touch tap on a point may navigate instead of pinning the tooltip (`use-chart.ts:130-142`, `line-chart.tsx:97`).
   - When the reviewer sent synthetic pointer and click events, the page drilled. The test tool sends mouse events, so this is not conclusive.
   - Fix: a tap with `pointerType === "touch"` on the point Link must `preventDefault` and pin. Only the link inside the pinned tooltip drills.
   - Verify with CDP touch emulation or on a device.

4. **LOW**: `supabase/migrations/00069_chart_series_review.sql:30,81`. When `p_to` is not given, the order set has no end date, but the day series stops at today. This was confirmed live:
   - A delivered order dated now+3d left the daily net at −310 620, while pnl showed −213 121.
   - The cumulative line therefore ends away from the period total.
   - Fix: pass `v_to` to `kpi_order_set`, or extend the series to the latest order day.

5. **LOW**: `00069:178,182`. `kpi_drill_orders` throws on bad input instead of returning 0 rows, which the 00061 convention requires. Only admins can reach it.
   - `{"weekday":"abc"}` raises an integer cast error.
   - A scalar `p_filters` raises "cannot delete from scalar".
   - Fix: check `jsonb_typeof(p_filters)='object'` and match `^\d+$` before the cast.

6. **LOW**: `src/components/dashboard/money-chart.tsx:37`. `windowNet = days.reduce(... d.net)` sums money in the component, which the brief forbids ("no formula"). The guard regex in `dashboard-kpi-source.test.ts:47` misses it.
   - Fix: return the window total from SQL and extend the guard to catch `reduce` over money keys.

7. **LOW**: `src/app/(app)/app/orders/all/page.tsx:78-79`. A reversed date range now raises through `chart_range_ok`, so the page shows "drill failed" where it used to show an empty list.
   - Fix: swap the dates, as Dashboard and Statistics already do.

8. **LOW**: the 366-day cap is enforced only in `kpi_daily`. `kpi_by_weekday_hour`, `kpi_by_product` and `kpi_outcomes` accept any range, which the brief caps for all RPCs. The impact is query cost only.

9. **LOW**: wording.
   - `orders/all/page.tsx:266`: the drill banner shows "Weekday 6". Use `statistics.charts.weekday.{n}`.
   - `ar.json` `weekdayShort`: اثن / ثلا / خمي / جمع are clipped non-words. Use the full names or the standard short forms.

10. **LOW**: `src/app/(app)/globals.css:150`. The light `--focus` is 55% alpha, so the chart focus ring is about 2.5:1 on light surfaces, below 3:1.
    - Fix: use an opaque ring token.

11. **LOW**: hour bars are about 14px wide at 390 (`bar-chart.tsx:121`) and have no touch snap, unlike the line chart.

12. **LOW**: every money-chart point drills to `drill=received` for that day, including the Total costs and Net profit points. The link label does not say so.
    - Fix: label the tooltip link "Orders of this day".

13. **LOW**: `share-parts.tsx:7`. The outcome donut's "Delivered x%" is a share of received computed in TS (D4). It sits next to the SQL delivery rate, which uses a different denominator.
    - Fix: label it "share of received", or return the share from SQL.

## Missing tests
- **Live SQL:**
  - A future-dated order with no `p_to`, checking that daily sum = pnl.
  - Malformed `weekday`/`hour` filters and a scalar `p_filters` on `kpi_drill_orders` return 0 rows.
  - Weekday/hour drill totals equal the chart buckets.
  - Isolation between two workspaces for all 4 RPCs, including ad spend and expenses.
- **Unit:**
  - `useChartNav`: ArrowLeft goes to index+1 in RTL; Home/End; Escape.
  - Touch: a tap pins without navigating, an outside tap dismisses, a second tap drills. Also snap-to-nearest in RTL with null days.
  - The tooltip flips at narrow widths.
  - The money-aggregation guard catches `reduce` in `money-chart.tsx`.
  - Toggle min-height on mobile.
  - An `ar` weekdayShort snapshot.
  - The weekday label in the drill banner.
  - The window note at ≥366 days, with the total equal to the windowed sum.
