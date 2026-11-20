VERDICT: FIX

## Summary
Route: surface ui, risk low, so ui-reviewer only. The sticky-cell ring works: I checked it live in the agent session and in the committed AR-dark and EN-scrolled screenshots. There is one continuous ring and no doubled indicator. The db-reset.sh change is correct. The command-palette focus-return change is in scope and sound.
Two medium findings block PASS: (1) the CSV export now mixes languages, and (2) PROGRESS.md contradicts itself.
Done-when #5 is met as a browser-only note, which the brief allows.

## Findings (ranked)

1. **MEDIUM**, `src/app/(app)/app/orders/all/orders-all-table.tsx:104-115`
   - Failure: only the "Order" header is translated. In AR, the CSV header row reads `الطلب,Placed,Customer,Phone,…`, so one column is Arabic and eleven are English. Before this change the header row was consistent, all English.
   - It also leaves 11 user-visible strings outside `src/messages` (AGENTS.md i18n rule).
   - Fix: translate every header through `t(...)`. Reuse the existing `fields.*` or `orders.col.*` keys and add only the missing ones, in en and ar (parity).

2. **MEDIUM**, `PROGRESS.md:553` vs `:555`
   - Failure: the same task appends two blocks that disagree. Line 553 says "Browser pass, Tab walk and screenshots … NOT done in this session, still open". Line 555 says the pass was done.
   - Effect: a future /bootstrap reading the log gets contradictory state.
   - Fix: delete the stale last sentence of the line-553 block.

3. **LOW**, order sheet Escape focus
   - Failure: Escape from the order sheet leaves focus on BODY, not on the table row, so the next Tab restarts from the top of the page. This is the same defect class as the palette bug fixed here.
   - It is logged in PROGRESS but has no plan row.
   - Fix: add a MASTER_PLAN follow-up row (do not widen this task).

4. **LOW**, brief screens list
   - Failure: the "scrolled sideways + hovered row" screenshot has no hover state. The PROGRESS note says "hover tool not available", but chrome-devtools MCP has `hover`.
   - Fix: take `f-all-en-light-scrolled-hover.png` with `mcp__chrome-devtools__hover`, or correct the note.

5. **LOW**, `src/components/command-palette.tsx:~37-49`
   - Focus is restored only when activeElement is BODY on close. This is acceptable.
   - There is no automated test (no DOM env, D55); it was browser-verified.

6. **NIT**, `scripts/db-reset.sh:21`
   - `PostgREST not ready after 30s` goes to stdout. The script's other FAILED lines also use stdout, so it is consistent. Leave it.

7. **NIT**, the brief named `orders.col.order`
   - The builder used `fields.order`, which exists in en and ar. That is fine; the key name in the brief was wrong.

## Missing tests
- Done-when #5 is browser-only by design (no pure seam; refactoring `page.tsx:156` was forbidden). A tiny pure `ordersLoadFailed(error, drillFailed)` helper plus a node test, including retry-URL param preservation, would close this cheaply. It could be a follow-up row.
- db-reset.sh readiness failure: shell, manual check is acceptable.
