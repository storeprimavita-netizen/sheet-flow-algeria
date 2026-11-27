# STATS-4 — Time, attempt and product × wilaya cuts

risk: low · surface: ui · lane: stats

Goal — Help admins see when orders arrive and where products fail to deliver, and relate confirmation outcomes to call timing and attempts.

## Done when

- Statistics keeps its URL filters and season-resolved Algiers date range. Weekday and hour buckets show order volume with their existing drills. Any additional rates use SQL's value, numerator, denominator and maturity (D4/D46).
- With a product selected, compare its delivery across wilayas. With a wilaya selected, compare products there. Both filters together show the intersection. The matched delivered/shipped drills keep both filters and the rest of the cohort.
- Time-to-first-call and confirmation by attempt are not part of this task: D108 moved them to STATS-5 (migration, after CONF-4).

## Trace

- `src/app/(app)/app/statistics/layout.tsx` uses `AdminGuardLayout` (D64). `page.tsx` already builds the range, `kpiFiltersJson` and `statsDrillFilters` once. No role or policy change is needed for these cuts.
- `src/components/stats/stats-charts.tsx` already shows weekday/hour counts using `kpi_by_weekday_hour` (00079), which also returns `kpi_rates`. The two charts group separately. Existing drill SQL applies the same Algiers buckets over `kpi_order_set` (00061).
- `kpi_by_wilaya` (00061) accepts a product and `kpi_by_product` (00079) accepts a wilaya through `p_filters`. A filtered comparison in either direction already has a SQL cohort. An all-pairs matrix would need another aggregation endpoint; the individual RPC results cannot be joined to recover intersections.
- `sell/orders/actions.ts` (`logConfirmationAttempt` under `src/app/(app)/app`) only increments `orders.confirmation_attempts`. `order_status_history` (00004) records initial states and state changes; a dial can leave status unchanged. The timing views in 00020 measure decision/delivery intervals. CONF-4's brief also calls out historical counter-only dials with no timestamp or outcome.
- The current counter is neither an event timestamp nor an attempt number frozen at confirmation. No shipped RPC groups the D46 cohort by first call or attempt number and drills to the same subset. Older unrecorded calls cannot be reconstructed.

## Build steps (no-migration split, D108)

1. `src/components/stats/stats-charts.tsx` and `src/app/(app)/app/statistics/page.tsx`: reuse the existing chart scope and SQL results. Surface the active wilaya or product in the corresponding comparison, and show the SQL delivery rate and small/immature cohort state. Reuse `WilayaSection` for per-wilaya details. Preserve the current weekday/hour ordering and empty/zero behavior.
2. `src/components/stats/stats-charts.tsx` and `src/messages/{en,ar}.json`: use `ordersQs` for the product and wilaya drills, with separate links for delivered and shipped counts where shown. Use existing chart loading, empty and error/retry patterns and localized labels. The comparison uses at most the existing RPC calls.
3. Run the gate, capture screenshots and record self-critique for independent UI review. Before writing frontend code, follow modern-web-guidance, cod-ui-polish and the local Next.js guide.

## Acceptance

- `src/lib/chart-series.rls.test.ts` and `src/lib/kpi-by-wilaya.test.ts`: assert the same product × wilaya slice in both directions, with a second wilaya, another product, an excluded order and a swap. Compare the shown numerator/denominator to delivered/shipped drill totals. Keep the UTC-to-Algiers hour/day boundary case.
- `src/lib/query-string.test.ts` and `src/components/stats/stats-components.test.tsx`: pin both filter directions and canonical drill parameters, plus empty, zero, and immature states. Keep resolved dates, source, category, agent and delivery type in cohort links.
- Screenshot Statistics with a selected product and a selected wilaya, and the corresponding filtered All orders drill. Verify EN/AR, dark/light and 390 px/desktop. Check keyboard access, RTL labels, empty and error/retry states.

## Decision — D108 (settled)

STATS-4 is split. This task builds only the no-migration Statistics views above: no new SQL function, no migration, no rate computed in the page, no all-pairs product × wilaya grid. The call metrics are plan row STATS-5 (migration, after STATS-4 and CONF-4); its brief must specify event capture, treatment of older orders without call events ("not recorded", never estimated, no backfill), and matching D4/D46 SQL rate and drill cohorts before implementation.
