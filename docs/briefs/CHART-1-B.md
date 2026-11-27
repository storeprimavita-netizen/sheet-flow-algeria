risk: low · surface: ui · lane: stats

# CHART-1-B — three CHART-1 mediums (D94; `docs/briefs/CHART-1.review-4.md` findings 1-3)

Goal: the daily charts never draw more than 366 days, a Money overview with no costs says "no data", and the cost-bar tables link like the bars.

Run: `nodb` — no migration, no SQL change, no new dependency, no new message key.

## Done when
1. Dashboard money chart and both Statistics daily charts get at most 366 days: the LATEST 366 of the series, oldest first.
2. Each shown day's figures are SQL `kpi_daily`'s own, unchanged; headline tiles are untouched.
3. `/app/money/overview` with every cost 0 shows `dashboard.v2.money.noData`; no bar, legend, "0 DA" rows or table toggle.
4. In table view, each row's first cell of a stacked bar / donut with `href` is a link to the same address as its segment (44 px tall below `sm`).

## Real code (checked; review paths are stale)
- `00079_chart_series_review.sql` still runs the series to the last order day, unbounded. Do not edit it.
- `supabase/config.toml` `max_rows = 1000`: a long series is cut to its OLDEST 1000 days today. So a plain `slice(-366)` in TS is wrong; order and limit in the query.
- Finance page is `src/app/(app)/app/money/overview/page.tsx` (moved by NAV-3).

## Changes
- `src/lib/kpi.ts`: export `KPI_DAILY_MAX_DAYS = 366`; `asKpiDaily` returns rows sorted by `day` ascending.
- `src/app/(app)/app/dashboard/page.tsx` and `src/components/stats/stats-charts.tsx` (`DailyCharts`): add `.order("day", { ascending: false }).limit(KPI_DAILY_MAX_DAYS)` to `rpc("kpi_daily", …)`. Keep the literal `rpc("kpi_daily"` (source guard test).
- `money/overview/page.tsx`: `empty={costSlices.some((s) => s.value !== 0) ? null : { title: t("dashboard.v2.money.noData") }}`. Keep all five slices when any cost is non-zero (D83).
- `src/components/charts/types.ts`: `ChartTableData.rowHrefs?: (string | undefined)[]`.
- `src/components/charts/share-parts.tsx` `shareTable`: set `rowHrefs: slices.map((s) => s.href)`.
- `src/components/charts/chart-panel.tsx` `ChartTable`: when `rowHrefs[ri]`, wrap the first cell's `<bdi>` in `Link` (`inline-flex min-h-11 items-center sm:min-h-0 hover:underline` + visible focus, tokens only). Other tables unchanged.

## Steps (commit + push each)
1. 366-day cap (query, `asKpiDaily`, tests).
2. Finance empty state (+ test).
3. Table links (+ tests).
4. Gate, screenshots, PROGRESS note.

## Acceptance tests
- `chart-series.rls.test.ts` "a far-future order: the ordered, limited kpi_daily is 366 days ending on its day": insert `placed_at` 2099-06-01, call with the same order/limit, expect 366 rows, first returned `2099-06-01`; delete the order in `finally`.
- unit `asKpiDaily` "returns days oldest first".
- `dashboard-kpi-source.test.ts` "both daily callers limit kpi_daily to the latest days" and "finance cost bar is empty when every cost is zero".
- `charts.test.tsx` "table view rows link like the slices" (`shareTable().rowHrefs`; render `ChartTable`, one anchor per row with href, none without).

## Screenshots (dark + light, EN + AR, 1280 and 390)
- `/app/money/overview`: a period with no costs; a period with costs, table view open.
- `/app/dashboard`: money chart; "Where the money goes" table view.
- `/app/statistics`: daily charts; outcome donut table view.

## Edge cases and assumptions
- One order dated years ahead still moves the window: the chart shows the 366 days ending on that day, and the existing "last N days shown" total is that window's own sum. This is the review's proposed window and D94's cap; no owner decision needed. All-time tiles stay exact.
- The database still computes the whole series for such an order (about 2 s at 2099, reviewer's measure). Bounding it needs a migration: out of scope, add one line to `docs/BACKLOG.md`. Rejecting absurd webhook `placed_at` is also out of scope.
- A range of 366 days or fewer is unaffected. The `>= 366` label wording and `windowNet` in the component are already in the backlog.
- Local DB is shared between workers: do not leave a future-dated order behind; do not run `db-reset`.
- This is a follow-up row: what stays open goes to `docs/BACKLOG.md`, never a new row (D89).
