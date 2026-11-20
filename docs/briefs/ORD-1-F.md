risk: low · surface: ui · lane: orders

# ORD-1-F — ORD-1 follow-up (D59 point 6, review-3 lows, review-4 "not covered")

Goal: finish the open ORD-1 polish: one visible focus ring across the frozen column, a real Tab walk, the screens review-4 skipped, an automated check of the orders/all error path, and review-3 lows #7/#8.

## Already done in ORD-1 round 4 (do NOT redo; verified in PROGRESS.md and the test file)
Missing-counter fallback test, ON CONFLICT asserts, swap_order / manual insert / webhook replay tests, error state browser check (`?product_id=x`). The plan line's "fallback test" item is stale.

## Done when
1. Focused row's ring is visible at full thickness across the frozen cell (EN+AR, both themes), still exactly one indicator, none when no row is current except the table outline.
2. Real Tab keypress (chrome-devtools `press_key Tab`) lands on the table, ArrowDown makes a row current; checked on orders/all, delivery, product orders.
3. CSV header "Order" comes from a translation key (`orders.col.order` exists at en.json:261; reuse it, add nothing if AR has it; keep EN/AR parity).
4. `db-reset.sh` prints `PostgREST not ready after 30s` if the readiness loop never succeeds, then continues/exits non-zero (pick exit 1).
5. An automated test for the orders/all error path exists without a DOM env or new dependency (see Files).
6. Gate OK (`scripts/gate.sh`).

## Files
- `src/components/data-table/data-table.tsx` (row ring :344, sticky td :364): the row `ring-inset` is painted under the opaque sticky cell. Fix: when `focus === i && tableFocused`, give the sticky cell its own inset ring/outline via the same condition (`ring-2 ring-inset ring-ring` on the sticky td, `outline` on the tr no) so the frozen part matches. Keep `--row-bg`, the `after:` divider and `border-collapse` (D59).
- `src/app/(app)/app/orders/all/orders-all-table.tsx:104`: label via `useTranslations`.
- `scripts/db-reset.sh:16-19`: message after the loop (track success flag).
- Error-path test: extract the page's "query failed -> error state" decision only if tiny; otherwise a node test of the existing helper. If no pure seam exists without refactoring `page.tsx` (:95 area), do NOT refactor: record that the check stays browser-only (no DOM env, D55) and screenshot instead. Decide at build time; either outcome satisfies #5 if noted in PROGRESS.md.

## Steps (each committed with scripts/step.sh)
1. data-table sticky-cell ring.
2. CSV header translation.
3. db-reset message.
4. Error-path test or browser-only note.
5. Browser pass + screenshots to `docs/design/audit/ORD-1/f-*`; PROGRESS.md block.

## Screens to screenshot (chrome-devtools; mouse AND real Tab)
orders/all: EN dark, AR light, AR dark, EN light, focused row, scrolled sideways + hovered row, 390 px width. Delivery and product-orders frozen tables: one theme pair each. Order sheet (row click, Enter) and order page. Command palette: Escape closes and focus returns to the trigger. Agent session (agent seed user) sees orders/all with `#0001`.

## Edge cases
- Sticky cell ring must follow RTL (inset ring is symmetric; fine) and not double up with the `after:` divider.
- Review-3 said the sheet did not open from a row click: if it still fails, that is a real finding; log it as a new plan row, do not widen scope.

## Decisions
None needed. No migration, no DB, no action/server change (risk low). Review: ui-reviewer only; if the diff touches server code, normal routing applies.
