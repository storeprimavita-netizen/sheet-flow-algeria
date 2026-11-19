VERDICT: FIX

## Summary
Reviewers: qa-reviewer (risk high) and ui-reviewer (surface ui), working independently on `git diff v3...v3-STATS-2-F`.
SQL is correct. The 00063 `shipped` predicate matches `sh` in 00060 exactly, and the function is still security invoker behind `is_admin()` with grants unchanged. Read-only checks on the local DB found that drill totals equal extras.shipped and home/stopdesk counts per wilaya and per commune, and a confirmation agent gets 0 rows.
Blocking: the D47 avg_days test cannot fail, most of the brief's named tests are missing, and every unmatured cell repeats the same hint text.
No reviewer ran a browser, so the brief's screenshots are unverified.

## Findings (ranked)

1. **Medium: the test cannot fail.** `src/lib/kpi-by-wilaya.test.ts:295-319`
   - The test "avg_days excludes a swapped delivered original" creates swap original `b` as `returning` and never sets it to delivered.
   - So `avg_days_sample === 1` still holds if the `not swapped` clause is deleted.
   - `expect(d).toBeTruthy()` asserts nothing, and `const [w] = await byWilaya(p)` picks an arbitrary row.
   - Fix:
     - Set `b` to delivered with a delivered history row before or after the swap, using the service role.
     - Pick the wilaya explicitly.
     - Assert that the sample counts only the plain delivered order.
   - The shipped test (around l.273) also never covers the swapped or cancelled-after-pickup branches (`zr_shipments`) of the new predicate. Add one order for each branch.

2. **Medium: missing tests from the brief's named list.**
   - WilayaTable:
     - chevron `aria-expanded` toggles
     - `aria-controls` is absent when closed
     - the Unknown row is never hovered
     - the null-wilaya row has no link
   - MetricCell shows visible text when unmatured. Only RateCell is tested.
   - AlgeriaMap/RateBar with `matured=false` renders. `algeria-map.test.ts` only checks the source data.
   - Drill banner:
     - renders the label spelling
     - leaving the drill removes the params (this test would catch finding 4)
   - An agent opening `/app/statistics` is redirected. Only the nav model is tested, not `AdminGuardLayout`.
   - orders/all drill count through the page: `commune_unknown`, invalid input, page total.
   - Impossible dates are rejected on the drill params. Only `parseStatsFilters` is tested.
   - `communeLinkable` false case at the commune-panel level.

3. **Medium (UI): the same hint repeats in every unmatured cell.** `src/components/stats/metric-cell.tsx:23`, `src/components/stats/rate-bar.tsx` (around l.230)
   - The "not enough data" paragraph prints in every unmatured cell, so up to three per row.
   - Most commune rows are unmatured (n < 10). With the extra details row added, the wilaya and commune tables become several times taller at 390px.
   - Fix: show one short visible marker per cell (for example a muted "n<10" or a dash plus an icon), with the full reason in sr-only/title text. Or show the hint once per row.

4. **Low: leaving drill mode keeps `commune_label` in the URL.** `src/app/(app)/app/orders/orders-filter-bar.tsx:51`, `src/components/data-table/data-table.tsx:139-140`
   - Both delete lists remove `drill`, `commune_key` and `commune_unknown`, but not the new `commune_label`.
   - Fix: add `commune_label` to both lists.

5. **Low: the banner trusts free-text `commune_label`.** `src/app/(app)/app/orders/all/page.tsx:55,262`
   - Example: `?drill=return&commune_key=hydra&commune_label=Oran` shows "Oran" while listing Hydra orders. React escapes the text, so it is not XSS, but a shared link can mislabel its own list.
   - Fix: show the label only if `label.trim().toLowerCase() === communeKey`, otherwise fall back to the key.
   - The banner for a home or stopdesk shipped drill also does not name the delivery type. Only the filter chip does.

6. **Low: an impossible date is dropped silently, and one call site is missed.** `src/lib/query-string.ts:129-130` with `statistics/page.tsx:68-76`
   - `from=2026-02-30&to=2026-03-01` becomes "all history up to Mar 1" with no notice.
   - Fix: add `from`/`to` to the list of dropped-parameter notes that `parsed` returns, which the page shows to the user.
   - `src/app/(app)/app/settings/seasons/actions.ts:16` still uses `.regex(ISO_DATE)`, so 2026-02-30 gets past zod and fails in Postgres with a raw error. Use `.refine(isRealIsoDate)`.

7. **Low: chevron hit areas may overlap.** `src/components/stats/wilaya-table.tsx:257`
   - `after:-inset-3` on a 24-28px button gives a 48-52px hit area. That is taller than a row of about 40px, so neighbouring rows' hit areas overlap on mobile.
   - Fix: check the row height at 390px, or use `after:-inset-y-2` with a 44px minimum.

8. **Low: the extras row breaks table semantics.** `src/components/stats/commune-panel.tsx:146-162`
   - The second `<tr>` holds a `colSpan=5` `<dl>` with no label, so screen readers read it as an unlabelled row.
   - Its `sticky start-0` cell spans the full table width, so the text scrolls out of view when the table is scrolled sideways.
   - Fix: move the extras into the first cell, or give the row a proper label and constrain the width.

9. **Low: `docs/DB.md` changed by one line only.** Confirm that the 00063 entry names the `shipped` metric and its 00061 lineage.

## Not run
- Live suite `src/lib/kpi-by-wilaya.test.ts`, because it writes data. Run it through the gate.
- Screenshots: dark and light, EN and AR, 1280 and 390.
