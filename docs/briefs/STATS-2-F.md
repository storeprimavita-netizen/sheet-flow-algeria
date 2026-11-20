risk: high · surface: ui · lane: stats

(high only because step 1 edits a SQL function in a migration that is admin-gated KPI data, no new table or grant.)

# STATS-2-F Follow-up of STATS-2 review-2 (12 lows + missing tests)

Goal: close the review-2 lows still present on v3 after STATS-3, and add the missing tests, with no new behaviour beyond them.
Spec: docs/specs/STATS.md. Decisions: D46, D47 (swap original counts as a return), D64 (admin-only KPI), D69 not relevant.

## Checked against current v3 (STATS-3 merged)
Nothing in the 12 was fixed or made moot by STATS-3; checked in code:
- #1 still open (`DrillMetric` has no shipped; home/stopdesk counts plain text). STATS-3 added `f_delivery` as a FILTER only, it does not link the extras counts.
- #2 #3 #5 #9 #11 still in wilaya-table.tsx (hovered===code with null; `open && "rotate-90 rtl:rotate-90"`; title-only cue; aria-controls always set; after:-inset-2 = 40px).
- #4 ISO_DATE is now in src/lib/query-string.ts (regex only), used by statistics parse (l.115-116) and orders/all (l.72-73).
- #6 `kpi_by_commune` (00061) still returns extras per commune, unused (only wilaya extras shown).
- #7 orders/all banner (l.260) prints lowercased `commune_key`. #8 only the drill fetch skips >120 (l.66); table link still shown.
- #10 breadcrumb: none app-wide -> drop (document in PROGRESS, no component). #12 product question -> see Owner.

## Steps (commit+push each)
1. Migration `00063_kpi_drill_shipped.sql` (latest is 00062): `create or replace kpi_drill_orders` = 00061 body plus metric `'shipped'` = same predicate as `sh` in 00060 `kpi_group_extras` (swapped or delivered/returned or after_pickup, incl. zr_shipments/history clause). Keep security invoker, `is_admin()`, grants unchanged (re-grant authenticated, revoke public/anon). Update docs/DB.md; no type regen needed unless signature changes (it does not).
2. query-string.ts: `DrillMetric` += "shipped"; add `isRealIsoDate` (regex + Date round-trip) replacing `ISO_DATE.test` in the 3 call sites; export `MAX_COMMUNE_KEY` check helper `communeLinkable(key)`. orders/all: accept drill "shipped"; `commune_label` display param for banner (#7), key stays the filter; `delivery_type` from the link (home/stopdesk) via existing p_delivery_type.
3. commune-panel.tsx: link home/stopdesk counts to shipped drill with delivery_type (#1); per-commune extras (#6): show avg days + home/stopdesk as a small second line per row, or drop extras fetch for communes (choose render; keep SQL as is); skip links when key too long (#8). i18n EN+AR for new strings.
4. wilaya-table.tsx: #2 `code !== null && hovered === code` (both uses); #3 `open ? "rotate-90" : "rtl:-scale-x-100"`; #5 visible muted "not enough data" text/marker in MetricCell when !matured (also used by commune table); #9 `aria-controls={open ? panelId : undefined}`; #11 hit area >=44px (`after:-inset-3`/h-11 on mobile, check row height); sort double-sort cleanup in drill fetch.
5. Tests, then screenshots, gate.

## Tests (by name)
- query-string.test: `rejects impossible dates (2026-02-30)` on statistics + drill params; `communeLinkable false over 120`.
- kpi-by-wilaya.test (live DB): `drill shipped count == extras.shipped` per wilaya, with delivery_type home/stopdesk == home_count/stopdesk_count; `anon and delivery agent get no rows from kpi_drill_orders`; `drill return includes swap original (D47)`; commune-level confirmed/return drill totals; `avg_days excludes a swapped delivered original`.
- component tests: AlgeriaMap/RateBar matured=false renders (not source text); chevron `aria-expanded` toggles, `aria-controls` absent when closed, Unknown row not hovered; MetricCell shows visible text when unmatured; drill banner renders label spelling and leaving drill removes params; null-wilaya row has no link.
- agent opening /app/statistics redirected (rbac/layout test).
- orders/all drill count via page (commune_unknown, invalid input, page total).

## Screenshots (dark+light, EN+AR, 1280 and 390)
/app/statistics (closed, row open, unknown row, unmatured cell), /app/orders/all?drill=shipped banner.

## Owner / decisions
- #12 (Latin wilaya/commune names in AR) is a product question: no DECISIONS row exists; ship nothing for it, leave open in PROGRESS. Does not block.
- No new DECISIONS row needed for the rest. #10 breadcrumb dropped (no app-wide component).
