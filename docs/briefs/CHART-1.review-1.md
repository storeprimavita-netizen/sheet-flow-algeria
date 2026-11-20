VERDICT: FIX

## Summary
Security is sound. All four RPCs are security invoker, stable, `search_path=public` and `is_admin()`-gated. anon has no execute grant, and the live RLS suite passes 11/11 (92/92 across the CHART-1 test files). `dashboard_stats.daily` has no remaining readers.
FIX for four reasons:
- Dense charts have overlapping hit targets, so a click opens the wrong day.
- Daily money no longer adds up to `pnl_lines` once the data spans more than 366 days.
- Drill-through links do not open the orders the chart counted (outcomes, weekday/hour, lost wilaya filter, UTC day boundary).
- A period with zero orders still draws the money chart.
Reviewers: qa-reviewer (with owasp-security) and ui-reviewer (ran the app in chrome-devtools). Screenshots are in `docs/design/audit/CHART-1/`.

## Findings (ranked)

1. **HIGH: overlapping 44px hit targets send dense-chart clicks to the wrong point.**
   - Where: `src/components/charts/line-chart.tsx` (point links) and `src/components/charts/bar-chart.tsx` (the 24 hour bars at 390px).
   - Failure: every link is 44px wide, but points are about 8px apart. Clicking the 06/11 point on Orders per day at 1280 opened the 08/11 orders list.
   - Fix: give each point a hit band exactly one pitch wide (a band or Voronoi rect). Use the 44px minimum only when the pitch is at least 44px. Keep the link for keyboard and assistive tech.

2. **MEDIUM: daily money stops matching the period total past 366 days.**
   - Where: `supabase/migrations/00068_chart_series.sql:42`.
   - Failure: `pnl_lines` is computed over the full period, but the series start is clamped to `v_to - 365`. On the default all-time dashboard, a workspace with more than a year of orders loses revenue, COGS and returns for the older days. The drawn fixed fees become `v_fixed - v_fixed_day*(v_days-366)`. The end of the cumulative line then differs from the "period total" in `money-band.tsx`. DB.md promises both "sums exactly" and "clamped", which cannot both hold.
   - Fix (pick one):
     - Reject ranges over 366 days (22023) and give the page a default bounded period.
     - Call `pnl_lines` with the clamped `v_from` and show that period's total.

3. **MEDIUM: Outcomes donut links do not match the slice counts.**
   - Where: `src/components/stats/stats-charts.tsx:84-90`.
   - Failures, per slice:
     - `unconfirmed` counts wait_for_confirmation + no_answer, but the link filters only wait_for_confirmation.
     - `cancelled` counts confirmation-cancelled + closed_phone + delivery-cancelled, but the link filters only `confirmation_status=cancelled`.
     - `in_progress` links to `confirmation_status=confirmed`, which also lists delivered and returned orders.
     - `returned` misses swapped originals.
     - The plain list also includes the excluded orders, duplicate suspects and replacements that `kpi_order_set` drops.
   - Fix: drill through `kpi_drill_orders` with an outcome metric that uses the same SQL CASE. At minimum, use the comma-list filters the list page already supports.

4. **MEDIUM: daily, product and weekday/hour drills drop filters and use UTC days.**
   - Where: `src/components/stats/stats-charts.tsx:56,140,206-208`, `src/lib/query-string.ts:171`, `src/app/(app)/app/orders/all/page.tsx:141-142`.
   - Failures:
     - `statsDrillFilters` drops `f_wilaya`, so with `?f_wilaya=16` active a click on a point or bar lists every wilaya.
     - The links are not in drill mode, so the list filters days by UTC date. The 23:30 UTC order is plotted on the 15th but listed under the 14th.
     - All 7 weekday bars and all 24 hour bars share one href (`/app/orders/all?delivery_type=home`).
   - Fix:
     - Add `drill=received` plus `wilaya_code`, passing `p_filters` through `kpi_drill_orders`.
     - For weekday/hour, either add a weekday/hour filter or drop the link and say "no drill" in the tooltip.

5. **MEDIUM: a period with zero orders still draws the money chart.**
   - Where: dashboard band 4, period 01/07–28/07/2026.
   - Failure: flat revenue and cost lines at 0 and a 100% cost bar. The brief requires one page-level empty state for zero orders.
   - Fix: if `received = 0` and there are no money values, render the empty state.

6. **LOW: `p_from > p_to` and the 366-day cap are only checked in `kpi_daily`.**
   - Failure: the other three RPCs silently return empty instead (the brief says all RPCs). A `from>to` URL also blanks the whole of dashboard band 4, including the valid cost bar (`dashboard/page.tsx:68`). Statistics then shows a retry that can never succeed.
   - Fix: validate in every RPC, and swap or reject the dates at page level.

7. **LOW: the fixed-fee remainder can go negative on the last day** (`00068:75`).
   - Example: 0.04 over 7 days gives 0.01 a day and −0.02 on the last day.
   - Fix: spread whole cents (floor/ceil steps) so no day goes negative.

8. **LOW: a future `p_from` with null `p_to` returns no rows, while `pnl_lines` still charges one day of fixed fees.**

9. **LOW: weekday x labels are thinned at 390px.**
   - Where: `bar-chart.tsx:102`, which budgets labels as `floor(w/44)`.
   - Failure: only 4 of the 7 day names show.
   - Fix: base the budget on label width, and always show every label when n ≤ 7.

10. **LOW: wrong footnote on Orders per day.** It says "deliveries are still coming in" on a received-count chart; it should say orders are still arriving.

11. **LOW: the pinned or focused tooltip spills outside its card** and overlays the filter block (`stats-focus-en-light.png`). Fix: clamp it to the card bounds.

12. **LOW: the Order journey card leaves a large blank area beside the stacked charts on the dashboard** (`dash-1280-en.png`).

## Missing tests
- Range over 366 days: daily sum equals `pnl_lines` (catches finding 2).
- Per-category outcomes:
  - closed_phone → cancelled
  - no_answer → unconfirmed
  - swapped original → returned
  - replacement excluded
- Drill href count equals SQL count for daily (Algiers day boundary), outcome, product, and with `f_wilaya` set.
- Weekday/hour hrefs are distinct and filtered, or absent.
- For more than 30 points, adjacent hit boxes do not overlap.
- A zero-order period renders the page-level empty state.
- RPC gate checked with a delivery_agent session (only confirmation_agent is tested).
- Daily rates with `p_filters` set re-aggregate to `kpi_set_rates`.
- `p_from > p_to` on all four RPCs, plus the page behaviour when it raises.
- `--chart-*` vs `--card` contrast at ≥3:1 in both themes (light `chart-3` unverified).
- Per-chart error boundary with `router.refresh()` retry.
- Table toggle: `aria-pressed`, caption, scroll above 90 rows.
- Touch tap pins the tooltip.
- Weekday labels at 390px.

## Not covered visually (fix round should screenshot)
These were not captured:
- Dashboard at 390.
- EN dark and AR light.
- Table view.
- Empty, loading and error states.

The h-bar charts showed only their empty state because the seed has fewer than 10 orders per wilaya/product. RTL leftward growth and worst-first order are therefore unverified.
