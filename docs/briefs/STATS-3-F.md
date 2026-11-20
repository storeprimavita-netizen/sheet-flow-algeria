risk: low · surface: ui · lane: stats

# STATS-3-F — follow-up to STATS-3 (review-4/5 lows, missing tests)

Goal: close the open lows and missing tests of `docs/briefs/STATS-3.review-4.md` and `review-5.md` with no migration, SQL, policy or action change.
No new DECISIONS row needed (D66 scope rules are spent; this is plain D40 follow-up).

## Definition of done
- Orders bar: "Clear all" shows when only a dropped note is present (r5 #1).
- Ordinary chip removal outside drill mode keeps category/agent/delivery chips (r5 #2); inside drill mode behaviour is unchanged.
- Statistics: a rejected/stale `season` or lone `year` does not persist (r4 #3), and one chip removal keeps valid `season`+`year` (r5 #3/#4 — the PROGRESS claim "removal drops season/year" is wrong; only the season chip does, by design). Correct that PROGRESS line.
- Statistics empty state shows one "Clear filters" action (r4 #7, r5 #5).
- Small UI lows fixed: AR agent select `truncate text-start dir=auto` (#6); orders drill chips on their own row below the grid (#8); no trailing "·" in the drill banner (#10); Seasons empty-period card `flex-col items-center` at 390 (#5); drill chip aria "remove" cue; admin-as-agent chip (agents list includes admins, #4).
- Repeated `delivery_type` param ignored with the dropped note (r5 #6).
- Missing tests (below) pass; no test loosened or removed (D55/D59/D63: no DOM env, no new dependency — logic goes into pure functions).
- `seasons.rls.test.ts` stops timing out with leaked workspaces (below). Gate green.

## Files and change
- `src/app/(app)/app/orders/orders-filter-bar.tsx`: Clear-all condition `chips.length>0 || dropped.length>0`; `leaveDrill` takes a `drill` flag (the page knows `DRILL_PARAMS` present) and removes the three keys only then; chip row own row; aria label.
- `src/app/(app)/app/orders/_lib/drill-filters.ts` (+test): extract `leaveDrillKeys(params, inDrill)` / `dropOneKey` as pure functions; repeated delivery_type handling; agents lookup incl. admins (page `orders/all/page.tsx`).
- `src/lib/query-string.ts`/`.test.ts`: replace the constant-equality test (`query-string.test.ts:42-44`) with behavioural tests of the pure functions.
- `src/app/(app)/app/statistics/page.tsx:133`: `active={{...f, season: season.season?.id, year: season.period?.year ?? undefined}}`; keep empty-state to one clear action (also `stats-filter-bar.tsx` ~l.255-266 vs page empty block).
- `src/components/stats/stats-filter-bar.tsx`: extract chip `remove` + `change` param edit into a pure helper (`stats-filter-edit.ts`) for testing; agent select truncation.
- `settings/seasons/seasons-editor.tsx`: empty card layout. Banner "·" in the orders drill banner component.
- `src/messages/{en,ar}.json`: only if a new key is needed (remove-cue aria); parity.
- `src/lib/seasons.rls.test.ts`: `beforeAll` timeout 30s; fix r4 #11 (compare `p_filters` null vs `'{}'` or direct counts); add `deleteWorkspaces` cleanup of leaked `tag()` workspaces for this suite via `src/lib/test-cleanup.ts`. Do not touch gate.

## Step order (each committed with scripts/step.sh)
1. Pure functions + unit tests (drill keys, chips: dropped-only, uppercase uuid, conf_agent dropped, unknown delivery key fallback "Selected", bar->drillChips wiring).
2. Orders bar fixes (Clear all, leaveDrill, layout, banner, aria).
3. Statistics `active` fix + chip-removal regression test (single removal keeps season+year; rejected season not persisted) + one clear action.
4. Small UI lows (AR select, Seasons card).
5. RLS test hardening: non-admin gets 0 rows from `kpi_by_wilaya`, `kpi_by_commune`, `kpi_drill_orders`; drill vs non-drill set parity for category/conf_agent; `SeasonCompare` error / in-progress / no-orders branches (render as pure logic if extractable); timeouts + cleanup.
6. Screenshots + PROGRESS note (fix the wrong claim); gate.

## Acceptance tests (names)
`leaveDrill keeps drill filters outside drill mode`, `dropOne removes exactly one key`, `uppercase uuid gives same chips`, `rejected season not persisted`, `chip removal keeps season and year`, `non-admin zero rows kpi_by_*`, `drill parity category/conf_agent`.

## Screens (dark+light, EN+AR, 1280 and 390)
All orders from a Statistics drill (chips, dropped-only state, banner); Statistics with all filters and empty state; Settings > Seasons empty period card. Previous r5 shots were 390 only: add 1280. Verify `<html>` class before naming files; say so if no browser MCP.

## Edge cases / stale
- Plan row's "chip removal drops season/year" is stale (r5 confirmed by browser + code); do not "fix" it, add the regression test.
- Tests run against live local DB (D24); run `scripts/db-reset.sh` first if leaked workspaces exist (cleanup is the fix, not skipping tests).
- Unlisted lows of reviews 1-3 stay out of scope unless trivially adjacent.
