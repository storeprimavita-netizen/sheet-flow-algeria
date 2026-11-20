VERDICT: FIX

## Summary
Two reviewers ran: qa-reviewer (risk high) and ui-reviewer (surface ui, tested live as admin and as the confirmation agent, EN/AR, 390 px).
- `scripts/db-reset.sh` rebuilt cleanly with 00056 and 00057. The full gate passed with the live RLS suite (616 passed). All review-1 exploit inserts are now refused, and no data leak or privilege gain was found.
- Review-1 blocker #1 is fixed. Views can now be created from Default and on confirmation and delivery through the UI, by admin and agent.
- Two new medium bugs block PASS: the search box keeps its value across view switches and Reset, and the status filter offers options that always return an empty list.
- All test views were deleted. The seeded shared views are unchanged. Screenshots: `docs/design/audit/CONF-1/round2-*` (14).

## Findings (ranked)

1. **MEDIUM. Switching views or pressing Reset brings the old search back.**
   - Files: `src/components/fields/search-param-input.tsx:31-44`, used by `src/app/(app)/app/orders/queue-filter-bar.tsx:48`.
   - Failure:
     - Only the query string changes on a view switch, so the page stays mounted and the input's `useState` value survives.
     - Example on confirmation: type "Amina", then click "New" (or Reset, Default, or "show closed").
     - The effect sees `value !== shown()` and, 300 ms later, writes `?view=…&q=Amina` back into the URL.
     - So the new view opens already "Modified", and Reset never clears `q`. This breaks the brief's rule "switching view discards edits". All-orders is affected too if it uses the same input.
   - Fix: set `key` on `SearchParamInput` (or `QueueFilterBar`) from `view` + `inherited` + the URL `q`. Or set `value` from `shown()` whenever `sp` changes from outside, and keep only user typing in local state.
   - Confirmed by reading the code. The reviewers did not reproduce it live.

2. **MEDIUM. The status filter offers options that always return nothing.**
   - Files: `confirmation/page.tsx:46,125`, `delivery/page.tsx:44,87-90`.
   - Failure:
     - When `show=all` is off, the page keeps only actionable statuses (`ACTIONABLE_CONFIRMATION` or `ACTIONABLE_DELIVERY`). The filter still lists `cancelled` on confirmation, and every terminal status on delivery (delivered, returned, …).
     - Picking one of them gives an empty table.
     - `show=all` is not stored in the view config, so a saved "Returned" or "Cancelled" view always opens empty, and users read that as "no orders".
   - Fix: list only actionable statuses unless `show=all` is on. Or let a terminal-status filter lift the actionable restriction, while keeping delivery's fixed `confirmed` filter. Add a page test for it.

3. **LOW. The cap of 20 can be bypassed by changing `scope`.**
   - File: `supabase/migrations/00057_order_views_hardening.sql:9-24`.
   - Failure: the cap trigger runs on INSERT only. Insert 20 views in `all` and 1 in `shipping`, then run `update set scope='all'`, and the group holds 21. Repeat for unlimited rows.
   - Fix: in a new migration, make `scope` immutable in `order_views_immutable`, or fire the cap trigger `before insert or update of scope, owner_id`.

4. **LOW. The name check `btrim` only removes ASCII spaces.**
   - File: `00057:4`.
   - Failure: through PostgREST, these names were accepted: `'New'||chr(160)`, a name with a trailing tab, and a name that is only a zero-width space. They make duplicate-looking or blank pills.
   - Fix: `name !~ '^\s|\s$'` plus a check that the name has at least one visible character.

5. **LOW. Gaps left from review-1 #4 and #10.**
   - `moveView` still renumbers one row at a time (`views-actions.ts:128-139`), so it is not atomic, and this is not documented.
   - Delete uses a custom dialog instead of `DeleteButton`.
   - There is no 3-pill Suspense skeleton for the strip.
   - Personal "Copy link" still uses the saved config (`view-tabs.tsx:61`). The two reviewers disagree on this one, so check it.

6. **LOW. "Save as mine" shows on the user's own personal views** (`view-tabs.tsx:120`), where it only makes a duplicate. Show it only on shared views.

7. **LOW. The "Save as view" button is too small and far from the controls.** It is 32 px tall at 390 px, under the 44 px tap target. On confirmation and delivery it also sits alone on a row away from the strip and filters (`round2-confirmation-admin-ar-light-390.png`).

8. **LOW. Focus is lost after Save, Save as, Reset and Create.** It lands on `body`. Move it to the active pill.

9. **LOW. `view-name-dialog.tsx` handles errors badly.**
   - After a server error, focus does not return to the name input.
   - If the session has expired, the dialog gets stuck with Save disabled and an uncaught "unexpected response" error. Catch it, show the error, and allow retry.

10. **LOW. Delivery has no seeds and no hint.** The strip shows only Default plus the Save button. Add the empty-personal hint there.

## Missing / weak tests
- A test that the search input resyncs after a view switch, Reset or Default (finding 1).
- A page test that a terminal-status filter is either not offered or not emptied by the actionable restriction (finding 2).
- An RLS test that the cap holds when `scope` is updated (finding 3).
- `order-views.rls.test.ts:159`, the "backfill" test:
  - Workspaces actually get their seeds from the trigger, and the test passes early when there is no second workspace.
  - So the migration's backfill line is never run by a test.
- `order-views.test.ts:14`: the seed parse test uses a copy of the configs, not the migration's values.
- The agent `?view` page test mocks `views = []`. It never checks that only agent-visible orders are listed.
- UI behaviour with no test yet:
  - keyboard path through the strip and menu, including Escape
  - agent sees no edit menu on shared views
  - focus moves to Default after deleting the active view
  - creating a view from Default
  - "Save as view" from the filter bar on confirmation and delivery
  - `?view=junk` is stripped from the URL
  - a duplicate-name error keeps the button as "Save"

## Review-1 status
| # | Status |
|---|---|
| 1 | Fixed (live). New issues are findings 1 and 2. |
| 2 | Fixed, apart from finding 4. |
| 3 | Partly fixed: the UPDATE path is still open (finding 3). |
| 4 | Not fixed (finding 5). |
| 5 | Fixed, with tests. |
| 6 | Fixed (code). |
| 7 | Fixed. |
| 8 | Fixed (live). |
| 9 | Fixed (live). |
| 10 | Partly fixed (finding 5). |
