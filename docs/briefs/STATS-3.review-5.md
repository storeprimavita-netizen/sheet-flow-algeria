VERDICT: PASS

## Summary
Round 5 diff `60e925f..v3-STATS-3` (whole task `v3...v3-STATS-3` @ ef4d9e3), judged against review-4 findings 1 and 2 and D66. Both reviewers finished. QA: no high or medium. The diff stays inside D66 scope (only `drill-filters.ts` + test, `orders/all/page.tsx`, `orders-filter-bar.tsx`, PROGRESS, screenshots). `tsc` is clean and 22 unit tests pass. UI (browser; dark/light and EN/AR checked by cookie + `<html>` class): category chip reads "Category: Abayas", delivery type is translated ("مكتب التوصيل" / "Stop desk"), `pickup` is dropped with the status note, and an uppercase uuid is accepted. Builder's concern is not reproduced: removing a single Statistics chip keeps `season`+`year`. Only the season chip drops both, by design. Both reviewers confirmed this in the browser and by tracing the code. Only lows remain → STATS-3-F.

## Findings (ranked, all low)

1. **Low** `src/app/(app)/app/orders/orders-filter-bar.tsx:177,198`: when the only filter is an invalid one (`?delivery_type=pickup`), the note shows but there is no chip and no "Clear all". The value stays in the URL and the note comes back on every reload. Fix: show "Clear all" when `dropped.length > 0`, or strip the dropped keys with `router.replace`.
2. **Low** `orders-filter-bar.tsx:51,180` (`leaveDrill`): removing an ordinary chip (e.g. Wilaya) also removes the category, agent and delivery-type chips, even outside drill mode. Fix: drop those three keys only when `drill` is set, or document the behaviour as intended.
3. **Low** `src/app/(app)/app/statistics/page.tsx:133` (review-4 #3, open, outside D66 scope): a stale `season`/`year` is carried forward when another chip is removed, so the "season no longer exists" note keeps returning. Fix: as in review-4 #3.
4. **Low** D66 (2)(d) screenshots are incomplete. No 1280 or Settings › Seasons screens from the builder. `final-orders-drill-390-ar-dark.png` shows the dropped note, not a translated AR chip. The ui-reviewer covered these with `r5rev-*.png` (no Seasons screen). The PROGRESS.md note "removing one Statistics chip also dropped season/year" is wrong (only the season chip does this): correct it so it does not become a STATS-3-F task.
5. **Low** Carried from review 4, seen again on screen:
   - Statistics Agent select at AR 390 clips the start of Latin names (#6).
   - Orders drill banner has a trailing "·" (#10).
   - At 390, chips wrap beside "Duplicates only" and are about 20px tall (#8).
   - Two "Clear filters" actions on the Statistics empty state (#7).
   - The drill chip's accessible name has no "remove" cue.
6. **Very low** `src/app/(app)/app/orders/all/page.tsx:34`: a repeated parameter (`?delivery_type=home&delivery_type=x`) is ignored silently, with no note.

## Missing tests (→ STATS-3-F)
- `conf_agent` dropped and reported; `drillChips` with an unknown delivery-type key falls back to "Selected".
- The bar → `drillChips` message-key wiring.
- Behavioural `dropOne` / `leaveDrill` key-removal tests (review-4 #11).
- A Statistics `change()`/`go()` regression test: a single chip removal keeps `season`+`year`; a rejected season does not persist.
- `OrdersFilterBar`: an uppercase uuid gives the same chips as the lowercase one.
- Still open from review 4: non-admin gets 0 rows from `kpi_by_wilaya`/`kpi_by_commune`/`kpi_drill_orders`; drill vs non-drill set parity; `SeasonCompare` branches.

## Coverage gaps
- The RLS suite and `gate.sh` were not run by the reviewers (both write to the DB); this round changes no SQL or policy.
- Not checked in the browser: keyboard focus and Escape, contrast ratios, light theme on Statistics, dark EN 390, the admin-as-agent chip (review-4 #4).
