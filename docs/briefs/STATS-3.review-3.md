VERDICT: FIX

## Summary
Round 3, diff `v3...v3-STATS-3` at 6561ccc. qa-reviewer + ui-reviewer. No high, 2 medium, 10 low.
Mediums per round: 6 → 4 → 2. None needs an owner decision. The SQL and RLS layer holds.
(The verify step ended before its reviewers; the coordinator assembled this file from their two reports, unedited in substance.)

## Checked and holding (qa, live local DB, read-only)
- One signature per changed function; old ones dropped after the two dependent views were rebuilt.
- Grants: `authenticated` + `service_role`, no `anon`; `seed_workspace` keeps its 00021 ACL; its body = 00014 + the season insert.
- `p_filters` values `'null'`, `{"wilaya":["16"]}`, `{"category":""}`, `{"wilaya":"16","x":null}` return 0 rows, none throws.
- Parity as admin: drill total 1106 = `kpi_set_rates` received = sum of `kpi_by_wilaya`; wilaya 16 drill = table.
- Confirmation agent: 0 rows from `kpi_by_wilaya` / `kpi_drill_orders`, null from `kpi_set_rates`, 0 seasons.
- Season tables RLS (admin only, UPDATE USING + WITH CHECK), composite FK, 00062. Actions: zod, admin re-check, translated errors, `useSubmitAction`.
- 00061 backfill inserts only the six seasons (review-2 #1 fixed).
- UI (AR, 390px): delete aria-labels + season-specific confirm, "No orders" compare card, visible "Selected" label, Period trigger shows the season range, dropped-source note is `role=status`, chips grouped with remove labels.

## Findings

### Medium
1. **A filter narrows the figures with no chip** (review-1 #1, another path). `src/lib/query-string.ts:110-128` `parseStatsFilters` lowercases uuids and turns `f_wilaya=06` into `6`; `src/components/stats/stats-filter-bar.tsx:89,95-97,132,151` compares the raw URL value. Example `/app/statistics?season=<UPPERCASE-UUID>`: the server applies the season, no "dropped" note, the bar shows no chip, the season select reads "All". Same for `product`, `f_agent`, `f_category` (uppercase) and `f_wilaya=06`. `pickParams` saves the raw values to localStorage, so the hidden filter returns on every visit. Fix: pass the normalized `f` from the server to the bar and build chips/select values from it, or write the canonical URL back.
2. **Drill leaves a hidden filter on Orders** (review-2 #5, still open; ui rates it medium, qa low). `src/app/(app)/app/orders/orders-filter-bar.tsx:40` `leaveDrill` deletes `category` and `conf_agent` but not `delivery_type`; `orders/all/page.tsx:102` keeps filtering by it with no chip. Fix: add `delivery_type` to the deletion list; chips for the three keys while in drill mode.

### Low
3. `src/lib/seasons.rls.test.ts:208-215` compares `kpi_summary`, `pnl_summary`, `dashboard_stats` with a second call of the same function (always equal). Compare with a fixture value or `kpi_set_rates(...,null)` received.
4. `stats-filter-bar.tsx:179` `setParam("year")` keeps `from`/`to`, so the dates win and picking a year changes nothing. Clear them as `setSeason` does.
5. `stats-filter-bar.tsx:99-104` an invalid `from`/`to` the server dropped still shows as a "Period: garbage" chip.
6. `docs/DB.md:79` still documents `unique (season, year)`; since 00062 it is `(workspace_id, season_id, year)` (review-2 #11).
7. `stats-filter-bar.tsx:63-66` `go()` re-saves values the server dropped, so the note reappears each visit; with only dropped values left, no chip and no "Clear all". Save validated values only, or show "Clear all" whenever a note is visible.
8. `stats-filter-bar.tsx:119` `useState(secondaryActive > 0)` is read once; restored secondary filters stay collapsed. Open the panel in an effect.
9. AR: wilaya chip/field shows "Alger — 16" while the aria-label reads "16 — Alger". Wrap code + name in `<bdi dir="ltr">`.
10. AR 390px: bar ~1250px tall with "More" open; Product takes a full row (pair it with Category); the empty state repeats "Clear filters" right under the chip row (brief: one action).
11. `seasons-editor.tsx` AR 390px: "Add dates" in the empty period card overlaps the dashed container's start edge and is not centred (flex-wrap + gap).
12. `season-compare.tsx:81` "in progress" has no test for a season whose `date_to` is today or later.

Info: `kpi_order_set` has no admin gate — intended (`dashboard_stats` uses it for agents under their own RLS); the brief's "admin-only" wording for it is wrong.

## Missing tests
- Uppercase uuid and `f_wilaya=06` give the same chips and the same SQL filter.
- Non-admin gets 0 rows from `kpi_by_wilaya`, `kpi_by_commune`, `kpi_drill_orders` (checked by hand; the suite covers only `kpi_set_rates`).
- `orders/all` returns the same set in drill and non-drill mode for `category`, `conf_agent`, `delivery_type` (the test at `:218` compares the RPC with a direct PostgREST query, not the page's code path).
- `leaveDrill` removes `delivery_type`.
- `SeasonCompare` error, "in progress" and no-orders branches.

## Not reviewed
- ui-reviewer: EN, desktop, light theme; dark was emulated but the app rendered light, so dark contrast is unverified; the edit dialog; error states of Seasons and the compare strip; keyboard and Escape; numeric contrast.
- qa-reviewer did not run the RLS suite (it writes data); the two unit files pass (19 tests).
- Screenshots: `docs/design/audit/STATS-3/r4-390-ar-dark.png`, `r4-seasons-390-ar.png`.
