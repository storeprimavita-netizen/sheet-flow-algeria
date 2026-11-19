VERDICT: FIX

## Summary
The gate passes: 617 tests passed and 3 skipped, the live RLS suite ran, and the local types regen matches byte for byte. One signature remains per KPI function, anon is denied, and the policies are admin-only with USING and WITH CHECK. The other `kpi_order_set` callers compile and run on the new signature.
Review-1 fixes #1-#4, #7 and #9-#13 hold. #5 (delete labels) is still open, and #8 (filters applied with no chip) is only part fixed.
Four medium findings remain. The 00061 backfill runs all of `seed_workspace` on production workspaces. Tests the brief requires are missing. The delete buttons have no context in their names. The compare cards show "0/0" as data.
No owner decision is needed.

## Findings (ranked)

### 1. Medium: the 00061 backfill runs the whole `seed_workspace` on every existing workspace
- **Where:** `supabase/migrations/00061_seasons.sql:156-162`.
- **Failure:** when the owner pushes this to remote, every live workspace also gets the `wilaya_fees` and `settings` inserts (`on conflict do nothing`). Settings keys the owner deleted come back.
- **Failure:** the option-set block is guarded only by `product_category` existing. A workspace that has the other sets but no `product_category` re-inserts all of them, the migration aborts with 23505, and the remote push fails.
- **Why it is a problem:** the brief only asked for the migration to seed the seasons.
- **Fix:** backfill only the six seasons with `insert into public.seasons ... select w.id, ... from public.workspaces w ... on conflict (workspace_id, name) do nothing`. Keep the redefined `seed_workspace` for new workspaces.

### 2. Medium: tests the brief requires are missing (listed in review-1, still absent)
- `src/lib/seasons.rls.test.ts:186-190` only checks that `dashboard_stats` runs. Nothing proves that `kpi_lines`, `kpi_summary`, `pnl_summary` and `dashboard_stats` return the same numbers with `p_filters` null, `'{}'` and the STATS-2 figures.
- No test checks that 00061 seeded the workspaces that already existed. `:192` checks a fresh workspace only.
- `:232` (period pointing at another workspace's season) only checks that some error occurs. It should assert code 23503 (FK) rather than 23505, so the 00062 fix has a regression guard.
- No test checks that `orders/all` returns the same set for `category`, `conf_agent` and `delivery_type` in drill and non-drill mode. Only the `ordersQs` round-trip is unit-tested.
- No test checks that `kpi_set_rates` is correct with more than 1000 orders.
- **Fix:** add these as SQL or RLS tests in the existing suites.

### 3. Medium: the Seasons delete buttons do not say what they delete (review-1 #5 still open)
- **Where:** `src/app/(app)/app/settings/seasons/seasons-editor.tsx`.
- **Failure:** the seeded page has 8 buttons that all read "حذف"/"Delete". There is no season or year in the accessible name, so a screen-reader user cannot tell them apart.
- **Failure:** the filled destructive style makes them the loudest element on every card.
- **Fix:** use `aria-label` "Delete season {name}" and "Delete {name} {year}". Make the season confirm say that its periods are deleted too. Use the ghost or destructive-outline variant.

### 4. Medium: the compare cards show "0/0" as if it were data
- **Where:** `src/components/stats/season-compare.tsx`.
- **Failure:** a year with no orders shows "—" stacked above "0/0" for every rate. The card is cramped and reads as real figures.
- **Fix:** when received = 0, show one "No orders" line per card instead of the rate rows.

### 5. Low: drill filters stay applied with no chip (review-1 #8, part fixed)
- **Where:** `src/app/(app)/app/orders/orders-filter-bar.tsx:39-41`.
- **Failure:** `leaveDrill` removes `category` and `conf_agent` but not `delivery_type`. Statistics links now carry it (`src/lib/query-string.ts:58`), and `orders/all/page.tsx:102` keeps filtering by it after drill mode is left.
- **Failure:** in drill mode, `category`, `conf_agent` and `delivery_type` narrow the list without a chip.
- **Fix:** add `delivery_type` to `leaveDrill` and show chips for all three.

### 6. Low: values the server dropped are still saved
- **Where:** `src/components/stats/stats-filter-bar.tsx:63-66`.
- **Failure:** the raw URL is written to `mnw:statsFilters`, so a dropped value comes back on every visit, with its note.
- **Failure:** when only dropped values remain there are no chips, so "Clear all" (`:225`) is hidden.
- **Fix:** save only the validated filters, or show "Clear all" whenever a dropped-value note is visible.

### 7. Low: "More filters" opens or closes only on first render
- **Where:** `src/components/stats/stats-filter-bar.tsx:119` (`useState`).
- **Failure:** after filters are restored from localStorage, the active secondary filters stay collapsed.

### 8. Low: "In progress" uses the UTC date
- **Where:** `src/components/stats/season-compare.tsx:81`.
- **Fix:** use the Africa/Algiers date helper.

### 9. Low: the chip for a season with no dates hides that the figures are all-time
- A season with no periods shows the chip "Season: Ramadan" while the figures cover all time. A note says so, but the chip does not.

### 10. Low: chip targets are small on touch
- Chip remove targets are about 24px tall, and "Clear all" is 98×32 and reads as plain text.
- The chip row has no group label.
- **Fix:** pad the targets to about 36px, add `role="group"` with a label, and give "Clear all" a button style.

### 11. Low: `docs/DB.md` is out of date
- It still documents `unique (season, year)`. 00062 changed this to `(workspace_id, season_id, year)`.

### 12. Info: the brief is wrong about `kpi_order_set` being admin-only
- `kpi_order_set` is invoker with no admin gate. Agents only see orders their RLS already allows, so nothing leaks, but the brief's "admin-only" wording is inaccurate.

## Missing tests and checks
- All the items in finding 2.
- `delivery_type` is removed when leaving drill mode.
- `pickParams` does not save dropped values.
- The `SeasonCompare` error, empty and "in progress" branches.
- Screenshots still missing:
  - Dark theme, EN and desktop 1280px for every screen.
  - The compare error state.
  - Seasons: the empty state, edit dialog, error state, and keyboard/Escape behaviour.
  - The filter bar with all 8 filters active.
  - The light theme in AR.
