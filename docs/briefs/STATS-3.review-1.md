VERDICT: FIX

## Summary
The SQL and RLS work is solid. `gate.sh --fast` is green (615 tests, live RLS suite). Every malformed `p_filters` value returns 0 rows without throwing, each changed function has one signature, other callers still compile, and `seed_workspace` keeps its full body.
The blocker is UI truthfulness. An active filter can be invisible, the Period field says "All time" under a season, and the compare strip highlights the wrong year and labels past seasons "In progress".
The screenshot self-critique is incomplete: AR, dark desktop, light 390px, compare error and the Seasons dialog/empty/error screens are missing.
Reviewers: qa-reviewer (SQL probes run live), ui-reviewer (partial, EN only; captures in `docs/design/audit/STATS-3/`).

## Findings (ranked)

### Medium
1. **An active filter can be invisible.** `src/components/stats/stats-filter-bar.tsx:95-98` creates a chip only if the value is in the options list, but `src/lib/query-string.ts:110-124` only checks the uuid shape.
   - Failure: `f_agent` = a deactivated agent, or `f_category` = an archived option (filtered at `statistics/page.tsx:45`). All rates are narrowed, yet there is no chip, the select shows "All", and "Clear filters" is hidden. localStorage restores it on every visit.
   - Fix: drop unknown values server-side with a visible note (as for `product`), or render an "Unknown" chip. Also note silently dropped invalid values (e.g. `f_source=facebook`).
2. **Period field contradicts the season.** `stats-filter-bar.tsx` passes `DateRangePicker from={get("from")}`.
   - Failure: with a season picked and no explicit dates, the trigger reads "All time" while the data is the season's range.
   - Fix: show the resolved season range in the trigger, or as a hint under it.
3. **Compare strip highlights the wrong year when dates override the season.** `statistics/page.tsx:126` and `src/components/stats/season-compare.tsx`.
   - Failure: `aria-current` and the ring stay on the season year while the figures are for the explicit dates. The selected card has no visible text, so colour is the only cue.
   - Fix: no highlight when `overridden`, and add a visible "Selected" label.
4. **"In progress" on finished seasons.** `season-compare.tsx` uses `!rates.delivery.matured`.
   - Failure: a past season with 0 or few delivered orders (Ramadan 2025) shows "In progress" on every card.
   - Fix: show "In progress" only when the period's `date_to` is today or later. Otherwise show the neutral "no data" state.
5. **Delete buttons all read "Delete".** `seasons-editor.tsx` (`DeleteButton`), `src/components/delete-button.tsx`.
   - Failure: 13 identical "Delete" buttons on one page, so a screen reader cannot tell them apart. Deleting a season cascades its periods, but the confirm text is generic.
   - Fix: `aria-label` "Delete Ramadan 2025" / "Delete season Ramadan", and a season-specific confirm saying its periods are removed too.
6. **Screenshot self-critique is incomplete** (AGENTS.md rule, brief "Screens"). `PROGRESS.md:378` covers light EN only.
   - Missing: dark+light × EN+AR at 390px and desktop; all 8 filters active with chips wrapping; empty; compare error; Seasons empty, populated, edit dialog and error.
   - Fix: capture them, fix what they show, and record it in PROGRESS.md.

### Low
7. **Cross-workspace existence probe.** `supabase/migrations/00061_seasons.sql:107` has `unique(season_id, year)`, which is checked before the composite FK.
   - Failure: workspace B gets 23505 vs 23503 and learns whether A has a period for year Y (needs A's season uuid; confirmed live).
   - Fix: `unique (workspace_id, season_id, year)`.
8. **`orders/all` keeps hidden filters.** `orders/all/page.tsx:114-118` applies `category` and `conf_agent` outside drill mode, and `leaveDrill` (`orders-filter-bar.tsx:39`) keeps them with no chip.
   - Fix: delete them in `leaveDrill`, or add chips.
9. **Rename loses the translation.** The rename dialog is pre-filled with the translated label (`seasons-editor.tsx:85`), and `actions.ts:70` nulls `name_key`.
   - Failure: saving unchanged in AR stores Arabic text for everyone.
   - Fix: pre-fill `name`, and null `name_key` only when the name changed.
10. **`savePeriod` reports false success.** The update at `actions.ts:96` returns ok on 0 matched rows.
    - Fix: `.select("id")` and check the length.
11. **A season without a year is never remembered.** `pickParams` (`query-string.ts:162-163`) drops `season` without `year`, and `setSeason` always deletes `year`.
    - Fix: persist the resolved year, or allow `season` alone.
12. **Received count is unformatted.** `season-compare.tsx:113` prints `counts.received` with no thousands separator.
    - Fix: use the `src/lib/format.ts` number formatter.
13. **Wrong message when seasons fail to load.** If the seasons query fails (`page.tsx:57`), the page shows "unknown season" instead of an error with retry.
14. **Smaller UI issues.**
    - The open-range "…" in the period chip is not translated or isolated (check AR).
    - The chip row has no group label.
    - The bar is ~850px tall on mobile with 8 filters.

## Missing tests
- An inactive agent or archived category in the URL: the filter is dropped with a note, or shown as a chip.
- The cross-workspace unique-constraint probe (after fix 7).
- `kpi_lines`, `kpi_summary` and `pnl_summary` give equal numbers with `p_filters` null vs before. Today only "runs" is checked.
- The migration seeds pre-existing workspaces (today only new ones are tested).
- `savePeriod` on a missing period id returns an error.
- `orders/all` drill vs non-drill return the same set for `category` / `conf_agent`.
- localStorage restore: allow-list, explicit URL wins, dashboard ignores stats keys (UI-level).
- `SeasonCompare` error and empty branches. A failed save keeps the typed fields (D62).
