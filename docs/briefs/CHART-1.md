# CHART-1 Charts instead of cards (D77)
risk: high · surface: ui · lane: stats
(high because it adds a migration with money series; admin gate + live RLS suite apply, D24)

Goal: shared hand-drawn SVG charts (line, bar v/h, donut, stacked bar) replace the waterfall and card walls on Dashboard and Statistics.
Done when:
- `src/components/charts/` has LineChart, BarChart (vertical + horizontal), DonutChart (<=5 slices, rest -> "Other"), StackedBar; each has axis labels, legend, hover/tap tooltip, keyboard focus on points/bars, "Show as table" toggle, token colours only (`--chart-*`, status tokens), correct in dark+light and RTL (logical props, axis reversed in RTL).
- Dashboard band 4 is a money line chart (revenue, total costs, profit per Algiers day) + cumulative toggle + period total beside it; cost breakdown = one horizontal stacked bar below. `pnl-waterfall.tsx` and `WaterfallBand` deleted.
- Statistics has: orders/day line, confirmation% + delivery% over time line, outcome donut, delivery rate per wilaya and per product (h-bars, worst first), orders by weekday and by hour (bars). Channel donut deferred: SRC-1 is `todo`, `orders.channel` absent (only `source`); add it in SRC-1-F/when SRC-1 ships, not now.
- Every stat card has a Lucide icon; max 4 cards per row before a chart.
- Four states per chart (skeleton / empty with action / error + retry / populated). No new dependency (D3). No colour hardcoded; gate lint passes.

## Real code found
- Only `ui/sparkline.tsx` exists; no `components/charts`. Waterfall: `components/dashboard/pnl-waterfall.tsx` + `WaterfallBand` in `money-band.tsx`, used at `dashboard/page.tsx:154`.
- Period totals only come from `pnl_lines`/`kpi_lines` (00031/00061). No per-day or weekday/hour series exists -> migration needed. Algiers day = `(coalesce(placed_at,created_at) at time zone 'Africa/Algiers')::date`; set = `kpi_order_set(p_from,p_to,p_product,p_filters)`.
- Plan row says migration "–" but this is stale: charts need SQL series (KPI rates only in SQL, AGENTS rule).
- Statistics page: `(app)/app/statistics/page.tsx` (admin+agent? check `getProfile`; agents get no money series).

## Migration `00068_chart_series.sql` (next number after 00067)
All `security invoker`, `stable`, `set search_path = public`, revoke from public/anon, grant authenticated; no new table so no RLS/trigger checklist beyond DB.md entry.
1. `kpi_daily(p_from,p_to,p_product uuid[],p_filters jsonb) returns jsonb` rows per day (generate_series so empty days = 0): received, confirmed, delivered, returned; confirmation/delivery % derived via `kpi_metric` (same denominators as `kpi_rates`, no new formula in TS). Money keys (`revenue,cogs,return_fees,ads,expenses,fixed`) only `if is_admin()` else omitted. Revenue/cogs same delivered rules as pnl_lines; ads/expenses by `spent_on`; fixed = monthly/30 per day. Invariant: sum of daily money = `pnl_lines` totals (test).
2. `kpi_by_weekday_hour(...)` returns weekday 0-6 and hour 0-23 counts + confirmation/delivery metrics, Algiers time.
3. `kpi_by_product(...)` delivery metric per product (or reuse `pnl_by_product` kpi; prefer reuse, check agent gating).
Types regen: `npx supabase gen types ... --linked` is owner-only; use local `--local`.

## Files
- NEW `components/charts/{line-chart,bar-chart,donut-chart,stacked-bar,chart-frame,chart-table,use-chart-nav}.tsx` + `chart-math.ts` (scales, ticks, nice numbers; pure, unit-tested). `chart-frame` owns legend, table toggle, tooltip, aria (`role="img"` + table alternative, arrow-key focus).
- NEW `components/dashboard/money-chart.tsx` (client toggle cumulative) replacing `WaterfallBand`; edit `dashboard/page.tsx`, `money-band.tsx`.
- NEW `components/stats/charts-section.tsx` + page wiring with Suspense per chart and retry.
- Messages EN/AR for every label; `check-i18n` parity. Numbers via `src/lib/format.ts` (tabular, DZD).
- Run `modern-web-guidance` search "svg chart accessibility", "tooltip popover".

## Steps (each committed with step.sh)
1 chart-math + tests. 2 chart primitives + stories-less render tests (RTL, empty, table toggle). 3 migration 00068 + RLS/live tests (agent gets no money keys; sums match pnl_lines; Algiers midnight edge). 4 dashboard money chart, remove waterfall. 5 statistics charts. 6 stat-card icons + row cap. 7 screenshots.

## Tests
`chart-math.test.ts`, `charts.test.tsx` (keyboard, table toggle, RTL, donut >5 collapse), `kpi-daily.rls` (agent no money; admin sum = pnl_lines), `dashboard-kpi-source.test.ts` stays green (no formula in page).

## Screenshots (both themes, EN+AR, mobile+desktop)
/app/dashboard, /app/statistics; chart tooltip, table view, empty and error states.

## Edge cases
Single-day period (line with one point = dot), all-zero series, negative profit axis crossing zero, long periods (>90 days: tick thinning), 0 delivered (rate "—" not 0%), RTL axis mirroring, tooltip on touch, colour-blind: pair colour with line dash/marker.

## Needs owner / DECISIONS
None blocking. Assumption: channel donut waits for SRC-1 (D77 says "after SRC-1"). Open point for the owner only if wanted: daily "total costs" includes prorated fixed fees (matches pnl_lines).
