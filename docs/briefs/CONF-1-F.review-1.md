VERDICT: FIX

## Summary
ui-reviewer, diff round 1: 1 medium, 2 low. Save can drop a status pick that is still loading.
Done-when 1, 2, 3, 5 passed live; 4 passed except finding 1; 6: `hold` gone, targeted tests pass (24), full gate not run here.
Limits: clicks and typing scripted; theme toggle, "Save as view" submit, Customers search, agent role and some no-match screen combinations not checked.

## Findings

1. **Medium** — `src/app/(app)/app/sell/orders/saved-view-bar.tsx:49-55` (all themes and locales): Save drops a status pick that is still loading.
   - Failure (reproduced, page request delayed 2.5 s): on a Modified view pick "No answer", press Save 0.5 s later. 10 s later address and picker still show the old status, and the view is still Modified.
   - Cause: `save()` builds `router.replace` from the old `sp`, which supersedes the status picker's pending `router.push` (`queue-filter-bar.tsx:51`). The replace is new in this diff and runs even when the box text is unchanged. `config` also holds the old status.
   - A pending Table/Kanban switch is likely to fail the same way (inferred, not tested).
   - Fix: build `next` and the saved filters from the box's latest sent query (expose it on the handle), or disable Save while a bar navigation is pending. Cancelling the timer without replacing would keep the address but still save the old status.

2. **Low** — `saved-view-bar.tsx:114-116` (from code only): Save as cancels the waiting search write before it knows the create worked. On a duplicate name or the view cap, a very fast submit leaves the typed text never written to the address, and a query that was never sent stays recorded as sent. Fix: expose `cancel()`, and call it only on success.

3. **Low** — `docs/design/audit/CONF-1-F/` does not exist, although the brief asks for screenshots. Fix: add them, or say in PROGRESS.md why not.

## Missing tests
- Save while a status or layout change is pending.
- The config saved through `withBox`, including an emptied box (no `q`).
- The document click handler (`data-search-discard`, link cancel).
- `search-empty.test.ts` checks page source with regexes and never renders the empty state.
