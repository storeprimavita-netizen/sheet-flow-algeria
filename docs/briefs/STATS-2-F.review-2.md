VERDICT: PASS

## Summary
Reviewers: qa-reviewer (risk high) and ui-reviewer (surface ui), working independently on `git diff v3...v3-STATS-2-F`.
SQL is correct. 00063 is the 00061 body plus `shipped`, which equals `sh` in 00060. The function is security invoker with `search_path=public`, there is one overload, and execute goes only to authenticated and service_role. On the local DB, drill totals equal extras.shipped/home/stopdesk with 0 mismatches. A confirmation agent gets 0 rows and anon gets `permission denied`.
Review-1 findings 1-9 are fixed: the D47 avg_days test can now fail, the shipped branches are each covered, DRILL_PARAMS is in both delete lists, and the per-cell hint is an icon with sr-only text. The unit suites pass (23/23).
Remaining items are low. The ui-reviewer captured only AR light at 1280 and at about 500px (the resize clamped). EN and dark are unverified (screenshots in docs/design/audit/STATS-2-F/).

## Findings (ranked)

1. **Low (UI): the unmatured marker is icon-only, and its reason is not readable on touch.** `src/components/stats/metric-cell.tsx:23`, `src/components/stats/rate-bar.tsx`
   - The roughly 16px icon carries its reason only in a `title` or sr-only text, which touch users cannot reach.
   - The marker adds a second line to every cell, so seeded rows (mostly unmatured) are about 2x taller.
   - This follows the fix review-1 prescribed (icon plus sr-only), so it does not block.
   - Fix: a short visible muted token (for example `n<10`) beside the icon, with the full sentence sr-only once per row.
   - The ui-reviewer rated this medium. I set it to low because it implements the fix review-1 asked for.
2. **Low (UI): the drill page has no way back to statistics.** `src/components/orders/drill-banner.tsx`
   - The banner only offers "show all orders", so the statistics filters are lost unless the user presses browser back.
   - The brief dropped breadcrumbs (#10), so this is out of scope here and goes to a follow-up.
   - Fix: a "Back to statistics" link that carries the same filters.
   - The ui-reviewer rated this medium. I set it to low as out of scope.
3. **Low: year 0000 passes `isRealIsoDate`.** `src/lib/query-string.ts:36-40`
   - `?from=0000-01-01` passes the JS round-trip, but Postgres rejects it ("date/time field value out of range").
   - The KPI RPCs then error, and Retry reuses the same bad parameter.
   - It is admin-only and needs a hand-edited URL.
   - Fix: also bound the year (for example 1900-2100).
4. **Low: the chevron hit area is 40px wide.** `src/components/stats/wilaya-table.tsx:~108`
   - `h-7 w-7` with `after:-inset-x-1.5` gives 40px wide by 44px high.
   - Fix: use `after:-inset-x-2`, then check at 390px that it does not overlap the name.
5. **Low: `communeBannerLabel` compares differently from SQL.** `src/lib/query-string.ts:47`
   - JS `trim()` strips NBSP and tabs, which Postgres `trim()` keeps. So some real spellings fall back to the lowercase key.
   - Cosmetic only. Fix: trim plain spaces only, as the SQL does.
6. **Low: an invalid date in drill mode is dropped silently.** `src/app/(app)/app/orders/all/page.tsx:75-76`
   - The list widens to all history, while the statistics page shows a note for the same input.
   - Fix: show the same dropped-date note.
7. **Low (UI): Latin names inside Arabic banner text are not bidi-isolated.** `drill-banner.tsx`
   - Fix: wrap the wilaya and commune names in `<bdi>`.
   - Latin names in AR remain the open product question (#12).

## Missing tests
- orders/all drill through the page has no tests: `commune_unknown=1`, `commune_key` over 120 (empty list, total 0), a bad `wilaya_code` or date, the page total equal to the RPC `total`, and `shipped` with `delivery_type`.
- Impossible dates at the orders/all call site. Only `parseStatsFilters` and the helper are covered.
- At the commune-panel level, a key over 120 renders plain counts with no link.
- "Leaving drill removes params" only checks the constant. It does not exercise `leaveDrill` or `toggleSort`.
- A visible-text assertion for the unmatured marker.
- Live `kpi-by-wilaya.test.ts` was not run by the reviewers (it writes data). The gate must run it.
