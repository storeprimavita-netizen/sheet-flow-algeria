VERDICT: ESCALATE

## Summary
This is round 4 with no PASS. Under D83(6), 3 medium findings is "anything else": no round 5, no merge, and the status becomes `blocked:merge needs owner OK`. There is no high finding, and no finding needs an owner decision on scope.
Security holds. The gate passed (900 passed, 5 skipped), and the live CHART-1 suite passed 15/15. Agents, the other workspace's admin, and anon all get 0 rows from every RPC. The daily sum equals `pnl_lines` exactly, with a future-dated order, in three cases: no dates, from-only, and a product filter.
The round-4 fixes hold:
- The Finance cost bar has 5 slices and the waterfall file is gone.
- A touch tap pins the tooltip.
- The toggles are 44px tall at 390.
- The range swap works on All orders.
- Arabic weekday names are full.
The 3 medium findings are listed below. Two are new in round 4 (#1, #2), and one is in a shared chart helper (#3).
Screenshots: `docs/design/audit/CHART-1/r4v-*.png`. These are the reviewer's own.

## Findings (ranked)

1. **MEDIUM**: `supabase/migrations/00069_chart_series_review.sql:84`. The round-4 future-order fix runs the day series to `greatest(v_to, max(od.day))` with no upper bound, so the brief's 366-day cap is lost.
   - Failure (reproduced live): a single order with `placed_at = 2099-06-01` is possible because the webhook `placed_at` is a free `z.string()`, `src/lib/webhook.ts:37`. With that order, `kpi_daily(null,null,null,null)` returns 26,536 rows (~19 MB jsonb) in 2.2s on a 60-order seed.
   - The default Dashboard then draws 3 × 26k `<Link>` points. The money band freezes, and the Statistics daily charts are hit the same way.
   - Fix: set `v_end := greatest(v_to, max order day)`. When `v_end - v_from + 1 > 366`, use the windowed branch over the last 366 days ending at `v_end`. Keep the order set and the `pnl_lines` bounds identical so the sums still match.

2. **MEDIUM**: `src/app/(app)/app/finance/overview/page.tsx:91-99,137`. The D83(1) rule "all costs zero → the bar's own empty state" can never show.
   - Why: `costSlices` always has 5 entries when `pnl` exists, so `empty={costSlices.length ? null : …}` is always null.
   - Failure: with zero costs, the card shows a blank 44px bar, five "0 DA · 0%" legend rows, and a table of zeros.
   - Fix: filter out zero slices (`.filter((s) => s.value !== 0)`), as the Dashboard bar does.

3. **MEDIUM**: `src/components/charts/share-parts.tsx:14` (`shareTable`). The table view of the Finance cost bar and of the Dashboard "Where the money goes" bar has no drill links (0 anchors in `main table`).
   - This breaks the brief's rule "every bar/slice/point links to the orders list" whenever the table is on.
   - It also leaves no reachable target for tiny slices: at 390, return fees are 6px wide and expenses 11px.
   - Fix: pass `href` through to `shareTable` and render the first cell as a `Link`. Legend rows could link too (see #5).

4. **LOW**: `src/components/dashboard/money-chart.tsx:36` and `src/components/stats/stats-charts.tsx:67`. The "last N days shown" wording keys on `days.length >= 366`.
   - Failure: a future extension or an exact 366-day leap-year period now produces 366+ rows with no SQL windowing, so the label is wrong. The amount is still equal.
   - Fix: return a `windowed` flag from SQL.

5. **LOW**: `src/components/charts/stacked-bar.tsx:36`. Slices below about 24px stay well under the 44px target.
   - Fix: raise `min-w`, or link the legend rows.

6. **LOW**: `src/components/charts/use-chart.ts:130`. Escape does not dismiss a pinned touch tooltip when focus is on the body, which is the case after a touch tap.
   - Fix: add a document keydown listener while the tooltip is pinned.

7. **LOW**: `00069:84` together with `pnl_lines`. `kpi_daily` returns 0 rows while `pnl_lines` charges one day of fixed fees (live: −2,933.33). This happens in two cases:
   - when `p_to` is before the first order;
   - when `p_from` is after today and `p_to` is null.
   The UI hides this behind the no-orders empty state.

8. **LOW**: `finance/overview/page.tsx`. The Revenue label link is 43×20px, below the 44px target on mobile. The ROAS product-slug links and the expense-category links are 20px tall.

9. **LOW, process**: D83(4) asks for `r4-*` screenshots, but none are committed on the branch.

Deferred by D83(5) to CHART-1-B and not counted here: review-3 lows 5, 6, 8, 10–13. That includes the translucent light focus ring and money points that drill with `drill=received`.

Pre-existing, outside this diff: anon has EXECUTE on `dashboard_stats`. It returns nothing, but should be revoked in a later task.

## Missing tests
- A far-future order with no dates returns ≤ 366 rows, and they sum to `pnl_lines` over the same window.
- Finance no-costs state shows the empty state. Finance slice order and hrefs.
- Table-view cells of `StackedBar` carry the slice links.
- A pinned tooltip is dismissed by Escape from the document.
- A real touch-emulation e2e for pin, outside-tap dismiss, and the drill from the tooltip link.
