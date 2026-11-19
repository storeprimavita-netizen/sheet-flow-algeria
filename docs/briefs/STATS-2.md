# STATS-2 Wilaya confirmation/delivery table + commune drill-down (brief)
risk: high · surface: ui · lane: stats  (new migration 00056 = SQL aggregation functions on the KPI contract; qa-reviewer + ui-reviewer)

**Goal:** a Statistics page with a per-wilaya table (and per-commune drill-down) whose every rate comes from SQL `kpi_rates` (D4), every number linking to its orders.

**Done when**
- `kpi_by_wilaya(p_from, p_to, p_product uuid[])` and `kpi_by_commune(p_wilaya int, p_from, p_to, p_product)` exist: `security invoker`, set = `kpi_order_set(...)`, grouped by `wilaya_code` / `commune`, one row each: received, confirmation, delivery, return (`kpi_metric` jsonb: num/den/value/matured), `avg_days_to_deliver` (first `delivered` row in `order_status_history` minus placed_at, delivered orders only, null if none), `home_share` / `stopdesk_share` (by `orders.delivery_type`), `top_return_reasons` (top 3 `options.label` via `cancellation_reason_option_id` on returned/cancelled-after-pickup orders, with counts). No money keys, so agents may call it. Anon: revoked.
- Small denominators ("12 orders, not enough to judge") use the `matured` flag, never coloured red/green; null commune groups as "unknown".
- Page `/app/statistics` (Sell group, nav key `statistics`, both roles): table sorted by received, in-cell bars (`RateCell`), expand a wilaya row = commune rows (lazy fetch via server action or `?wilaya=` URL param, prefer the URL param). Existing `AlgeriaMap` beside the table. Click on a count = `/app/orders/all?wilaya_code=&commune=&...` (add `commune` and `delivery_type` params to `orders/all/page.tsx` filter).
- Filters on this page: period + product only (STATS-3 adds the rest); state in the URL, reuse `DashboardFilterBar` pattern. The orphan `dashboard/wilaya-section.tsx` is moved into `src/components/stats/` and extended (not duplicated); delete the dashboard copy.
- Four states: skeleton (`loading.tsx`), empty with action, error with retry, populated. Logical CSS props, no hardcoded colours. EN/AR keys with parity.

**Files**
- `supabase/migrations/00056_kpi_by_wilaya.sql`: the two functions; revoke from public, anon, grant authenticated; `docs/DB.md` rows; regen `database.types.ts`. No new table (no RLS/trigger checklist). Index `orders (workspace_id, wilaya_code, commune)` only if EXPLAIN shows need.
- `src/lib/kpi.ts`: types `WilayaKpiRow`, parser (no formula). `src/lib/query-string.ts`: `ordersQs` accepts commune.
- `src/app/(app)/app/statistics/{page,loading}.tsx`; `src/components/stats/wilaya-table.tsx`; `src/components/nav-model.tsx` + `nav-model.test.ts`; `src/messages/{en,ar}.json`.
- `settings/page.tsx:125` keeps reading `wilaya_stats` (untouched).

**Steps (each commit+push)** 1 migration + DB.md + types. 2 SQL tests. 3 kpi.ts types + page server fetch + table. 4 commune drill-down. 5 orders/all commune/delivery_type filter + drill links. 6 nav + i18n + loading/empty/error. 7 screenshots, gate.

**Tests (src/lib/kpi.test.ts new describe, live DB like existing)**
by_wilaya rates equal `kpi_rates` over the same wilaya ids; excluded and unconfirmed duplicates absent; 23:30 UTC order lands on its Algiers day; commune rows sum to the wilaya row; null commune grouped; avg_days only from delivered orders; home/stopdesk shares sum to 1; top reasons ranked; agent session gets rows and no money keys; anon cannot execute; other-workspace rows never returned; denominators < 10 give `matured=false`. Component test: not-enough-data row has no red/green class. nav-model test updated.

**Screens:** `/app/statistics` and a drilled wilaya, dark+light, EN+AR, 390 px width, empty and error states, agent login.

**Edge cases / assumptions**
- Plan says "Home dashboard + Sell → statistics tab": P1-2 already moved wilaya off Home and no Statistics page exists, so this task creates it (no DECISIONS row needed; STATS-3/4 extend the same page).
- Return reasons are only on orders where an agent picked a reason; show "no reason recorded" bucket.
- Carrier-side wilaya/commune spelling may differ from `wilaya_communes`; group on the stored `orders.commune` text, trimmed and lowercased for grouping, display first spelling.
- STATS-2 blocks CARRIER-3 (routing by wilaya success rate): keep the function output stable.
- Remote `db push` stays owner-only. No open owner question.
