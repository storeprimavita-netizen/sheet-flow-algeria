VERDICT: FIX

## Summary
Round 1 (qa-reviewer run to completion; ui-reviewer PARTIAL — it checked only admin login, Settings › Options & labels at 1280 px dark EN, and the picker / input aria-labels in the DOM). No high finding. Two mediums, both introduced by this task: the picker cells lost their readable names, and non-compact pills lost their width cap. Lows 3–8 are small and inside this task's own files — fix them in the same round. Low 9–11 may go to a follow-up if they do not fit.
QA checked: full diff against the brief and NAV-4 review-3; 4 NAV-4 test files (21 unit tests pass); live RLS suite with 00074 applied (11/11); the new CHECKs in a rolled-back transaction. Local dev has 0 overrides and 0 option emoji, so the migration's data fix ran only against empty tables.
This file was assembled by the coordinator from the two reviewers' reports, because the verify stage returned before they finished. Findings are the reviewers', not the coordinator's.

## Findings (ranked)

1. MEDIUM (qa) — `src/components/fields/emoji-field.tsx:92`. Picker cell names went from `aria-label={e}` (a screen reader says "fire") to "Emoji 3 of 36". A screen-reader user can no longer tell which emoji a cell is — worse than before for the point this task was meant to fix. Fix: drop the cell `aria-label` so the glyph is read, or use `"{emoji}, {n} of {total}"`. Also check that `aria-selected` on `role=gridcell` buttons has a parent grid/row in the DOM (ui).
2. MEDIUM (ui) — `src/components/status-pill.tsx:~55`, `src/components/status-select.tsx:62,67`. `truncate` is now set only when `compact` is true, so non-compact pills (orders tables, kanban cards) have no max width and no `min-w-0`; a 40-character override label can stretch or overflow a table cell or a 390 px card. And (qa, low) the compact select trigger in the orders list status cell is still cut at 9rem, against the brief's "drop truncate inside select triggers". Fix both together: pills truncate by default (or get `min-w-0 max-w-full`), and never truncate inside a `SelectTrigger`, compact or not. Verify on the kanban card and the orders list at 390 px.
3. LOW (qa) — `src/lib/emoji.ts:57` and `00074`. Labels made only of invisible characters still pass: zod accepts U+2800 (Braille blank); the DB CHECK accepts labels made only of ZWJ, U+FFA0, U+1160, U+2060, U+180E, U+E0020 or NBSP (tested: `label_ok=t`, `nonblank=t`). Fix: add U+2800 to `INVISIBLE`/`FORBIDDEN`; add a DB CHECK requiring at least one character outside the whitespace/invisible set.
4. LOW (qa) — `00074` emoji CHECK. The positive test is not anchored, so `'BUY NOW 50% 🔥'` passes, and so does an emoji followed by U+3164 / U+FEFF: the emoji CHECK did not get the new invisible set. Fix: require every character to be in the emoji / ZWJ / FE0F / skin-tone / keycap set; add the invisible code points to the emoji CHECK; correct the DB.md sentence ("accepts some arrows" understates the gap).
5. LOW (qa) — `00074` lines 5–9. If a row's only label consists only of newly banned characters, the data fix sets both columns to null, violates `sl_nonblank_chk` and aborts the migration (a risk on the owner's remote push). Fix: delete rows whose labels would both end up blank first, then update.
6. LOW (qa) — `src/app/(app)/app/settings/actions.ts:625-627`. Clearing a language is delete-then-update and can race: two admins clearing different languages of the same row → both deletes miss, one update then breaks `sl_nonblank_chk`. Not atomic either (ui). Fix: do the clear as one SQL statement, or retry the delete on a 23514 from the update.
7. LOW (qa + ui) — `status-labels-section.tsx:62-70`. EN and AR are saved one after the other; if EN succeeds and AR fails, the UI shows only an error and EN is already saved. Fix: say which language failed, or refresh the row / keep dirty state per language.
8. LOW (ui) — `status-pill.tsx`. `title={text}` is now on every pill, including icon-only and emoji-only ones, duplicating the sr-only and visible text for assistive tech. `splitLeadingEmoji` builds a new `Intl.Segmenter` on every render — hoist it to module scope.
9. LOW (ui) — `src/app/(app)/layout.tsx:38`. The toaster offset is a hardcoded `4.5rem` duplicating the topbar `h-14`; not a token. AR toast position unverified — check it clears the topbar in RTL and at 390 px.
10. NOTE (ui) — `docs/design/audit/NAV-4-F/labels-1280-light-en.png` is a dark capture; rename it or retake it in light.

## Missing tests
- `status-pill.test.tsx`: "no truncate class in select trigger" renders `StatusPill` directly, not `StatusSelect`, so it misses finding 2.
- `nav4.rls.test.ts`: "two sequential per-language saves keep both labels" uses a raw `.update()`; the action uses a one-column `upsert` on conflict, and nothing live proves that path leaves the other language alone.
- zod and DB both reject a label made only of invisible characters (finding 3); the emoji CHECK rejects emoji + text (finding 4).
- The migration's data fix when a row ends up with both labels blank (finding 5).
- Picker: one cell has `tabIndex=0` and an arrow key moves it; the trigger label includes the current value.
- A partial-failure save in `status-labels-actions.test.ts` (finding 7).

## Not verified by any reviewer (do in the screenshot pass of the next round)
Light theme, AR/RTL, 390 px, the saved toast, the kanban card select, the orders list, the keyboard focus ring in the picker, and the four states of the labels section.
