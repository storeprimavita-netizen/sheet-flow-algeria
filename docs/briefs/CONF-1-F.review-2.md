VERDICT: FIX

## Summary
ui-reviewer, re-check of `58fa8ad..22c700d`: review 1 #1 is not fixed (now rated high); #2 fixed (code only), #3 fixed.
`search-param-input.test.ts` and `sell/orders` tests pass (99); full gate not run. No other regression found in the touched lines.
Not checked: Delivery live, Arabic, light theme, 390 px, agent role, "Save as" during a pending navigation; no screenshots.

## Findings

1. **High** (review 1 #1, not fixed) — `src/app/(app)/app/sell/orders/saved-view-bar.tsx:47-62` (reproduced as admin, EN dark, Confirmation; the code is shared with Delivery): Save during a pending navigation saves nothing and stays disabled.
   - Failure (Slow 3G, Save 0.5-0.6 s after the action): with a status pick, a Kanban to Table switch, or a typed search still loading, press Save. 30 s later the `saveView` POST was never sent, address and controls show the old values, Save is disabled until reload, and there is no message. The status case also reproduced twice with a delayed page request.
   - Cause (reviewer's reading of Next 16.2.11, `next/dist/client/components/app-router-instance.js:143-161`): `router.replace` supersedes the pending navigation, which leaves the action queue's `last` on the discarded node; the `saveView` server action is appended there and never runs.
   - `config` and `layout` (`:42`, `:58`) also still come from the old props, so the pending status or layout would not be in the saved view.
   - Probably older than the fix commit (the previous code also replaced before saving); not tested on the old code.
   - Fix: do not navigate before `saveView`. Cancel the timer (`box.cancel()`), await the save with the box text, then `router.replace` on success, keeping the cancelled text if the save fails. Also disable Save and Save as while a filter bar or search navigation is pending (for example a shared `useTransition`): this keeps the saved config current and avoids an orphaned action after two superseded navigations.

## Missing tests
- Save while a navigation is pending: `saveView` is called. The new `latest()` test only exercises the sync object, so it passes while Save is broken.
- The saved config while a status or layout change is pending.
- The saved config for an emptied box (no `q`).
