VERDICT: FIX

## Summary
Round 4 diff `v3...v3-STATS-3` @ 13023c9. Both reviewers ran to completion (qa-reviewer, ui-reviewer). QA: no high/medium, both review-3 mediums fixed (normalized filter-bar state, `leaveDrill` drops `delivery_type`); RLS/grants/single signatures/p_filters zero-row cases probed on the local DB. UI (browser, AR light only, 1280 + 390): two mediums remain on the `/app/orders/all` drill chips (category chip with no value, raw untranslated delivery type). Findings shrank vs round 3, so per loop.md (up to 5 rounds while shrinking) this is FIX, not ESCALATE. Round 5 is the last allowed.

## Findings (ranked)

1. **Medium** `src/app/(app)/app/orders/orders-filter-bar.tsx:107` category drill chip shows only "Category" / "الفئة" with no value. The user cannot tell which category is narrowing the list. Fix: resolve the uuid against the `product_category` options and render "Category: <label>" (same as the statistics chip). If the lookup misses, fall back to a "selected" label, not a bare key.
2. **Medium** `src/app/(app)/app/orders/orders-filter-bar.tsx:110-111` delivery_type chip shows the raw value ("نوع التوصيل: home") in AR. Also, outside drill mode a value other than `home`/`stopdesk` gets a chip but filters nothing, and inside drill mode it silently returns 0 rows. Fix: only show the chip for allowed values. Use the same translated home/stopdesk labels as the statistics bar. Drop or flag invalid values with the usual dropped note.
3. **Low** `src/app/(app)/app/statistics/page.tsx:133` passes the raw `f` as `active`. A rejected season (deleted, or stale in localStorage), or a `year` with no season, stays in the canonical params. `change()` copies it forward and `go()` persists it, so the "dropped" note comes back on every visit. "Clear all" stays hidden when that is the only value. A lone `year` cannot be cleared because the Year select is disabled. Fix: `active={{...f, season: season.season?.id, year: season.period?.year ?? undefined}}`, or show "Clear all" whenever a note is visible.
4. **Low** `orders-filter-bar.tsx:109` the `agents` list excludes admins, so a `conf_agent` that is an admin renders as a raw uuid chip. Fix: include every workspace member in the label lookup.
5. **Low** `src/app/(app)/app/settings/seasons/seasons-editor.tsx` empty-period card at 390px AR: the "Add dates" button overlaps the dashed container's start edge and is off-centre (review-3 #11 still open). Fix: `flex-col items-center` with the button under the text.
6. **Low** Statistics agent select at 390px AR clips the start of Latin names ("onfirmation (seed)"). Fix: `truncate` + `text-start` + `dir="auto"` so it cuts at the end. Also align the chip label with the select label.
7. **Low** Statistics empty state with filters shows a second "Clear filters" button right under the chip row's "Clear all". The brief wants one action (review-3 #10). Fix: keep one.
8. **Low** Orders drill at 390px: the chips sit between the "Duplicates only" toggle and the filter grid, and wrap awkwardly with the toggle. Fix: give the chips their own row below the grid.
9. **Low** Statistics 390px "More filters": Product takes a full row. Pair it with Category (review-3 #10 remainder).
10. **Low** The orders drill banner shows a trailing "·" after "Received orders" when `drill=received` has no sub-label.
11. **Low (test quality)** `src/lib/query-string.test.ts:42-44` compares `DRILL_FILTER_KEYS` with a hard-coded copy of itself and does not exercise `leaveDrill`. `src/lib/seasons.rls.test.ts:208-215` (review-3 #3 still open) compares `kpi_summary`/`pnl_summary`/`dashboard_stats` with a second call of the same function, so it always passes. Fix: compare against a baseline with `p_filters` null vs `'{}'`, or against direct counts.

## Missing tests
- Non-admin gets 0 rows from `kpi_by_wilaya`, `kpi_by_commune`, `kpi_drill_orders` (verified by hand only).
- `orders/all`: drill vs non-drill return the same set for `category` and `conf_agent`.
- `leaveDrill` / `dropOne` remove exactly the right keys (behavioral, not constant equality).
- Filter-bar render: an uppercase uuid and `f_wilaya=06` yield the same chips as the canonical values.
- `SeasonCompare` error, "in progress" (`date_to` >= today) and no-orders branches (review-3 #12).
- A rejected season/year does not persist across visits (localStorage).

## Coverage gaps (reviewer could not verify)
- ui-reviewer could not switch to the dark theme (every screenshot rendered light) and did not visit EN. Chip-removal clicks, "Clear all" and Escape were not exercised. The builder must screenshot dark + EN in round 5. Screenshots so far: `docs/design/audit/STATS-3/r5-*.png` (files named `-dark` are actually light).
- qa-reviewer did not run the RLS suite or the full `scripts/gate.sh` (both write to the DB). Read-only probes plus `tsc` and the unit tests (24) passed.
