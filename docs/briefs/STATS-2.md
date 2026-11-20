# STATS-2 Wilaya confirmation/delivery table + commune drill-down (brief, rewrite after review-0 + D64)
risk: high · surface: ui · lane: stats  (new SQL functions on the KPI contract; qa-reviewer + ui-reviewer)

**Goal:** an admin-only `/app/statistics` page with a per-wilaya table and commune drill-down; every rate from SQL `kpi_rates` (D4), every count linking to the exact orders behind it.

**Done when**
- Migration `00058_kpi_by_wilaya.sql` (00056/00057 are on unmerged v3-CONF-1; recheck latest number at merge). `kpi_by_wilaya(p_from,p_to,p_product uuid[])` and `kpi_by_commune(p_wilaya int,p_from,p_to,p_product)`: `security invoker`, execute revoked from public+anon, granted authenticated, and **return zero rows unless `public.is_admin()`** (D64). Never `security definer`.
- Set = `kpi_order_set(...)` joined to orders; group key `nullif(lower(trim(commune)),'')` (NULL = unknown, labelled via i18n, not a literal); display spelling `mode()`/`min()`. Per group: `kpi_rates(array_agg(id))` -> received (`counts.received`, never `count(*)`; D46/D47), confirmation, delivery, return (num/den/value/matured). Matured stays `kpi_metric`'s (den>=10, unresolved<=20%); no new constant.
- Extras: `avg_days_to_deliver` (delivered non-swapped, from `coalesce(placed_at,created_at)`, plus sample size, null if none); `home_count/stopdesk_count/shipped` over the delivery-rate denominator (null shares when 0 shipped). No money keys.
- Return reasons: source is NOT settled by D64 and reasons exist only on cancel. **Drop the reasons column in STATS-2** (no data source for returned parcels); revisit with a new decision, not here.
- Unmatured data is never red/green: `RateBar`/`RateCell` get a `matured` prop (neutral track, no status class); `AlgeriaMap` takes `matured` per datum (grey "not enough data" fill + legend entry) instead of `minOrders`.
- Drill links hit `orders/all` and match the table count: add a drill mode to `orders/all/page.tsx` using the same set (Algiers day on `coalesce(placed_at,created_at)`, `excluded_reason is null`, not unconfirmed duplicate) and the same commune key; unknown commune = reserved token meaning `is null`; add `delivery_type` filter.
- Page admin-only: `statistics/layout.tsx` = `AdminGuardLayout`; nav item `statistics` in Sell after `customers`, `adminOnly: true`, icon `MapPinned`; `visibleNav` and agent menus untouched.
- Four states: `loading.tsx`, `error.tsx` (reason+retry), empty with action (widen period / clear product), populated. Commune panel has its own Suspense skeleton and inline error+retry.

**Files**
- `supabase/migrations/00058_kpi_by_wilaya.sql`; `docs/DB.md` rows; regen `database.types.ts` (no new table; no index, grouping is on an expression).
- `src/lib/kpi.ts` types+parser (no formulas); `src/lib/query-string.ts` (`ordersQs` commune, delivery_type, unknown token).
- `src/app/(app)/app/statistics/{layout,page,loading,error}.tsx`; `src/components/stats/{wilaya-table,wilaya-section}.tsx` (move orphan `src/app/(app)/app/dashboard/wilaya-section.tsx`, unused by any import; drop its stop-shipping props, `settings/page.tsx` keeps `wilaya_stats`); `rate-bar.tsx`; `src/components/dashboard/algeria-map.tsx`.
- `src/components/nav-model.tsx` + test (incl. `activeLeafHref`, ⌘K `navLeaves`, no item for either agent role); `src/messages/{en,ar}.json` (parity; PageHeader purpose, breadcrumb Sell > Statistics).
- Filters: period+product only via the `DashboardFilterBar` pattern, URL state.

**Steps (each commit+push)** 1 migration+DB.md+types. 2 SQL tests. 3 kpi.ts + page fetch + table. 4 `RateBar/RateCell/AlgeriaMap` matured. 5 commune drill-down (`?wilaya=` via `<Link scroll={false}>`, one open, keeps params, invalid ignored; separate `button aria-expanded aria-controls`, mirrored chevron in RTL). 6 orders/all drill mode + links. 7 nav, i18n, loading/empty/error. 8 screenshots, gate.

**Tests (live DB in `src/lib/kpi.test.ts`, plus components)**
admin rows equal `kpi_rates` over same wilaya ids; confirmation-agent and delivery-agent sessions get zero rows from both functions; anon cannot execute; other-workspace/NULL `p_wilaya` returns nothing; `''`, `'  Alger '`, NULL communes group right; commune rows sum to wilaya row; excluded + unconfirmed duplicates absent; 23:30 UTC lands on Algiers day; swapped original counts as return (D47); unresolved >20% gives matured=false even with 10+ orders; no shipped parcels gives null shares; avg_days excludes swapped/undelivered; drill-link count == orders/all count (incl. 23:30 UTC, unknown token); component: matured=false has no success/warning/danger class on RateCell/RateBar/map, aria-expanded toggles; agent opening page redirected; nav test.

**Screens (dark+light, EN+AR, 390px):** `/app/statistics`, a drilled wilaya, empty and error states. No agent screen (D64). At 390px: sticky first column (`sticky start-0`), keep received/confirmation/delivery/return; avg days and home/stop-desk in the expanded panel; map below table. `bdi dir="ltr"` on %, n/N, days; `text-end` numerics; denominator as visible text.

**Edge cases / assumptions**
- Page does not exist yet; this task creates it (P1-2 already moved wilaya off Home).
- Carrier spelling may differ from `wilaya_communes`; group stored text only.
- CARRIER-3 depends on stable output; non-admin gets nothing (D64).
- Out of scope, separate task: `dashboard_stats` executable by anon/PUBLIC.
- No new DECISIONS row needed; owner questions: none open (Q-19 is logged, not blocking).
