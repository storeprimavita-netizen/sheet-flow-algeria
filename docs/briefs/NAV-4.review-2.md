VERDICT: FIX

## Summary
Round 2 diff review of `git diff v3...v3-NAV-4` by qa-reviewer (risk high) and ui-reviewer (surface ui).
The verify step ended before writing this file; the coordinator assembled it from the two reviewers' reports, findings unchanged.
No high finding. Review-1 HIGH 1 is fixed: `status-pill.tsx` is a client component and 16 pages that render pills load as admin with no error (stock, product detail + stock + orders, products, store, store pages, store reviews, customer detail, orders list and detail, shipping, confirmation, tasks, settings). Review-1 MEDIUM 3 is fixed: `emojiSchema`, `startsWithEmoji` and the live `options_emoji_chk` accept flags, keycaps and ZWJ sequences and reject a lone regional indicator, two flags and "1️⃣2".
DB and security side: no new RLS, tenant-isolation, ICU or client/server-boundary problem. `nav4.rls.test.ts` passes 7/7 with `LOCAL_SUPABASE_URL` set. The agent session sees overrides and no money.
Three medium findings block: the screenshot evidence, the accessible name of an emoji-only override, and the store status select ignoring overrides.

## Findings (ranked)

### MEDIUM
1. **Screenshots still do not meet Done-when** — `docs/design/audit/NAV-4*` (both reviewers).
   - `agent-orders-en-dark-1280.png` is a light, phone-width Confirmation page with no status column and no override; "agent session sees override" is not shown.
   - `kanban-en-dark-1280.png` shows the Table view, not the kanban.
   - `NAV-4-R/orders-ar-light-390.png` shows only filters, no pills.
   - `settings-en-dark-1280.png` and `settings-ar-light-1280.png` show the Workspace section, not the options or labels block; the AR light one is clipped on its right edge.
   - No screenshot shows a saved override, an emoji-only override, a 40-character label in a compact pill, or a label starting with an emoji hiding the Lucide icon.
   - Missing: nearly all 390 px shots, most light and EN/AR pairs, an agent session in AR, a picker in EN, `/login` at 390.
   - Fix: save a real override, re-capture with `?section=options` scrolled to the labels block, capture agent and admin views, the actual kanban and the edge cases, with file names that match the content.
2. **Emoji-only override has no accessible status name** — `src/components/status-pill.tsx:44-56` (review-1 finding 4, brief line 23).
   - Orders-page HTML for a "✅" override is `<span class="max-w-[9rem] truncate" title="✅">✅</span>`, no sr-only default label. `chip.tsx:81` supports `emojiLabel` but StatusPill never passes it.
   - Fix: when the resolved label is emoji-only, render the default label as sr-only text. Add a test.
3. **Store status select ignores overrides** — `src/app/(app)/app/store/_components/settings-form.tsx:72-73` still uses `ts("draft")` / `ts("live")` (review-1 finding 9).
   - Fix: use `useStatusLabel`.

### LOW
4. Invisible characters pass both `labelSchema` and the DB CHECK: U+061C, U+FEFF and U+2028 mid-string, U+00AD, U+034F, U+115F; a label of just U+3164 gives a blank pill. ZWJ is stripped from labels, so "👩‍💻 Dev" is saved as "👩💻 Dev". `src/lib/emoji.ts:5` and the 00073 `sl_*_chk` constraints.
5. Saving one language overwrites the other — `settings/actions.ts` `saveStatusLabel` upserts both `label_en` and `label_ar`.
6. Emoji picker: all 36 cells are in the Tab order (tabIndex 0 on every cell) and each cell's aria-label is the raw glyph. Fix: roving tabindex and named cells. Keyboard arrows, Enter and Escape work.
7. Accessible names: the picker trigger is "Emoji" on every option row; every labels input is only "English" or "Arabic" and rows are not grouped. Fix: include the option or status name.
8. Overrides load sequentially on every `/app` page — `src/app/(app)/app/layout.tsx:21`, awaited before the `Promise.all` (not re-checked by the UI reviewer).
9. Preview shows the page locale only, and the toast says "Label saved." with no reload hint (optional).
10. The labels block is one list of about 40 rows; optional: collapse per group.
11. Placeholder colour: acceptable as is (visibly lighter than typed text).

## Missing tests (none added since round 1)
- `emoji.test.ts`: no cases for 🇩🇿, #️⃣, 1️⃣ (schema or `startsWithEmoji`); no RLS case showing the DB accepts a flag.
- No smoke or render test of a server page that renders StatusPill; nothing would catch a future loss of `"use client"`.
- StatusPill with an emoji-only override includes an sr-only default label.
- `saveStatusLabel`, `resetStatusLabel` and `setOptionEmoji` reject an agent at the action layer.
- An agent sees an override in a client component and on a server-rendered page.
- The label schema and CHECK reject U+061C, U+2028, U+2029, U+FEFF and U+3164.

## Not checked
- The UI reviewer looked at 8 of the 19 screenshots and judged the rest by file name; it saved no new screenshots.
- A 40-character label in a compact pill, contrast measurements, and every theme at every width.

## Notes
- Pre-existing, not from NAV-4: on the orders list (EN, dark, 1280) the Customer column bleeds under the sticky Order # column.
- Test data left in the local database by the UI reviewer: English label overrides on two confirmation statuses ("pending confirmation" = "🇩🇿 Awaiting call", "no answer" = "✅"). Reset them in Settings › Options & labels, or keep them for the screenshots and reset afterwards.
