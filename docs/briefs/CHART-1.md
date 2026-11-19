# CHART-1 Charts instead of cards (D77)  [amended after review-0]
risk: high · surface: ui,security · lane: stats
(high: new SQL series RPCs on money; D64 admin gate + live RLS suite apply, D24)

Goal: shared hand-drawn SVG charts (line, bar v/h, donut, stacked bar) replace the waterfall and card walls on Dashboard and Statistics, fed by admin-only SQL series.
Done when:
- `components/charts/` has LineChart, BarChart (v+h), DonutChart (<=5 slices incl. "Other"), StackedBar. Each: axis labels, legend with DZD/% values, tooltip, table toggle, token colours (`--chart-*`, status tokens; `--chart-*` vs `--card` >=3:1 in both themes, fix light `chart-3` if not), dark+light, RTL (time oldest-at-right, Y axis right, h-bars grow leftward, `bdi` on Latin names, text not mirrored).
- Money chart: 3 series each with colour + dash + marker (solid/circle, dashed/square, dotted/diamond). Immature recent days drawn dashed + owner-visible note (revenue by order date, ads by spend date: right edge dips). Day with no rate = gap, not 0%.
- A11y: `role="group"` + labelled roving-tabindex point list; Left/Right (flip in RTL), Up/Down series, Home/End, Enter drills through, Escape closes tooltip; focused value announced; token focus ring. Touch: tap pins tooltip, outside tap/Escape dismisses, `touch-action: pan-y`, tooltip flips at 390px. Table toggle = button `aria-pressed` + real `<table>` caption/scope, tabular LTR numbers, >90 rows scroll w/ sticky header.
- Drill-through: every bar/slice/point links to the orders list with matching filters (reuse `ordersQs`/`statsDrillFilters`), 44px targets.
- Dashboard band 4 = money line + cumulative toggle + period total; cost breakdown = one h stacked bar (ads USD first, D45). `pnl-waterfall.tsx` + `WaterfallBand` deleted.
- Statistics sections: Volume and conversion / Outcomes / Where / When (SeasonCompare + WilayaSection stay, placed in Where). Orders/day, confirmation%+delivery% lines, outcome donut, wilaya + product h-bars (worst first, min-count floor), weekday + hour bars. Channel donut deferred (SRC-1 todo). Cards: Lucide icon, grid `lg:grid-cols-4` max.
- States per chart: skeleton at real height (~220px min), own empty copy + action, own error boundary with `router.refresh()` retry; zero orders = one page-level empty state. No draw animation (or `prefers-reduced-motion`). No new dependency (D3); D3 overrides cod-ui-polish `components.md:3` recharts mention.

## Real code (verified)
- Only `ui/sparkline.tsx`. Waterfall used at `dashboard/page.tsx:154`. Both pages already behind `AdminGuardLayout` (`statistics/layout.tsx`, `dashboard/page.tsx:18`) so no agent UI branch.
- `pnl_lines` (00031:235) returns `period_from/period_to/fixed_share`; fixed = `round(monthly*days/30*share,2)` once. `kpi_by_wilaya` (00061:269) calls `kpi_rates` per group: copy that pattern. `dashboard_stats.daily` (00031:~531) is unused.

## Migration `00068_chart_series.sql` (latest on v3 is 00067)
Number clash: `v3-VAR-1` also has 00068 (parked, unmerged); per project rule CHART-1 keeps 00068 and **VAR-1 must renumber to 00069+ when it merges** (STORE-3 adds no migration past 00055; recheck at merge). All fns `security invoker`, `stable`, `set search_path=public`, revoke public/anon, grant authenticated; no table, so DB.md entry only.
1. All RPCs return null/no rows unless `public.is_admin()` (D64). Reject `p_from > p_to`; cap range 366 days; default bounds = `pnl_lines` `period_from/to`. Weekday/hour/day from `ts at time zone 'Africa/Algiers'`.
2. `kpi_daily(p_from,p_to,p_product,p_filters)`: per day (generate_series) counts and rates by calling `kpi_rates` per day (counts from its `counts`, not `orders_received`); never average daily rates. Money keys: revenue/cogs/return_fees as pnl_lines; ads/expenses by `spent_on`; fixed = day share of `round(monthly*days/30*fixed_share,2)`, rounded per day with remainder on the last day so sum equals `pnl_lines` exactly. Money keys omitted when non-product `p_filters` set. Include immature flag per day.
3. `kpi_by_weekday_hour`, `kpi_by_product` (kpi_by_wilaya pattern, not `pnl_by_product`), `kpi_outcomes` (<=5 categories summing to `received`, defined in SQL).
4. Same migration drops `daily` from `dashboard_stats` (one daily money formula).
Types: `supabase gen types --local`.

## Steps
1 chart-math + tests. 2 primitives + render tests. 3 migration + live tests. 4 dashboard money chart, delete waterfall, update guard test. 5 statistics charts + drill hrefs. 6 card icons/grid. 7 screenshots.

## Tests
`chart-math.test.ts` (negative/zero domain, single point, thin >90d, ticks include 0); `charts.test.tsx` (keys, RTL x order, table = plot numbers, donut collapse, hrefs); live SQL: agent + anon get nothing from all RPCs; admin daily sum = `pnl_lines` (no dates, product filter, 7-day 10000/month); `p_from>p_to` rejected; 23:30 UTC lands next day/hour 0; daily re-aggregates to `kpi_rates`, swaps/replacements don't shift counts; donut sums to received. `dashboard-kpi-source.test.ts`: replace `pnl-waterfall` assertion with `money-chart.tsx` containing no formula and `s.value !== 0`-style zero-guard; scan `money-chart.tsx` + `components/charts/*`. `check-i18n` parity.

## Screenshots
/app/dashboard + /app/statistics at 1280 and 390, dark/light, EN/AR; pinned tooltip, focus ring, table view, empty/loading/error per chart type, negative profit, single day, >90-day thinning.

## Owner points (no DECISIONS row needed)
Totals count by order date; recent days dashed. Week starts Saturday in AR, Monday in EN (locale choice).
