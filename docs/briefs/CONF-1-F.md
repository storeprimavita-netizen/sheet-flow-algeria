# CONF-1-F — queue search box timing + "no match" empty state
risk: low · surface: ui · lane: orders · migration: none · deps: CONF-1 (done)

Goal: on Confirmation and Delivery, typed search is never lost or delayed by another control, and a search with no match says so.
Sources: `docs/briefs/CONF-1.review-4.md` #1, #2, #3, #6 · D63 (the sync rule) · D92. No new DECISIONS row.

## Done when
1. Status picked, then more typing before the page arrives: the address ends with both the status and the new search.
2. Following a link to another address (pointer or Enter) within 300 ms of typing: no search write, however slow the page is. Same for Reset.
3. Pressing a control that leaves the address alone (Compact rows, Columns, theme, `tel:` link) does not delay the search: written 300 ms after the last key.
4. Save / Save as / Save as view store the text now in the box (emptied box = no `q`); after Save the view is not "Modified", also 6 s later.
5. A search with no match on both queues (table and board) shows `orders.noMatch` + "Clear search", never "No orders in your queue." / "New order".
6. `hold` and `holdDelay` are gone. Gate OK.

## Changes (paths under `src/`)
- `components/fields/search-param-sync.ts`
  - `fire`: `new URLSearchParams(sent.at(-1) ?? lastQs ?? "")` (an outside change already empties `sent`).
  - delete `hold`, `holdDelay`; add `text(): string` (trimmed box text).
  - add pure `leavesAddress(link: {href, target, download}, event: {button, metaKey, ctrlKey, shiftKey, altKey}, currentHref)`: true only for a plain primary click, same origin, target "" or `_self`, no download, and a different pathname+search (hash ignored).
- `components/fields/search-param-input.tsx`
  - replace the `pointerdown` effect with a capture-phase `click` on `document` (keyboard activation fires it too): `sync.cancel()` when the target is inside `a[href]` with `leavesAddress` true, or inside `[data-search-discard]`.
  - handle becomes `{ mergeInto, text }`. A box given `syncRef` (the queue bar only) also registers in a module variable inside an effect (cleared on unmount); export `activeSearchBox()`. This avoids a client wrapper in the two server pages.
- `app/(app)/app/sell/orders/saved-view-bar.tsx`
  - Reset button gets `data-search-discard`.
  - `save()` and the dialog's `createView`: `const box = activeSearchBox()`; with a box, config = `{ ...config, q: box.text() || undefined }`.
  - `save()` also does `const next = new URLSearchParams(sp.toString()); box.mergeInto(next); router.replace(`${path}?${next}`, { scroll: false })` before `await saveView`. This cancels the waiting write. `createView` success already replaces the address; call `box.mergeInto(new URLSearchParams(sp.toString()))` first, only to cancel the timer.
- `app/(app)/app/sell/orders/_lib/kanban.ts`: `clearSearchHref(path, sp, viewConfig)` = current params minus `q` and `page`; set `q=CLEARED` when the view saves a `q` (same rule as `orders/(list)/page.tsx:251`).
- `sell/confirmation/confirmation-table.tsx`, `sell/shipping/delivery-table.tsx`: optional `search?: { q: string; clearHref: string }`; when set, `empty` = `orders.noMatch` / `orders.noMatchHint` / `ButtonLink` `orders.clearSearch` (copy of `orders-all-table.tsx:245`).
- `sell/orders/order-board-empty.tsx`: optional `search`; when set, same title, hint and button. All-orders page passes nothing.
- `sell/confirmation/page.tsx`, `sell/shipping/page.tsx`: build `search` from `cfg.q`, pass to table and board. Keep the diff small (see Edge cases).
- No new message keys.

## Steps (commit + push each)
1. `fire` fix + test (review #1).
2. `leavesAddress`, click cancel, `data-search-discard`, remove `hold`; tests.
3. Save paths through the box handle.
4. Empty state (helper, two tables, board, two pages); tests.
5. Live check + screenshots, PROGRESS.md line, `scripts/gate.sh`.

## Tests
`components/fields/search-param-input.test.ts`: replace m, n, o (they test the removed `hold`; replace, do not just drop) with:
- "status picked then more typing before the echo keeps the status"
- "m: link cancel then a slow outside address: nothing is written" · "n: leavesAddress is true only for a plain click to another address" (table: modifier, `_blank`, `tel:`, other origin, same URL, hash only) · "o: text() is the trimmed box text"
- "an echo with reordered params is the box's own write" · "same query, changed inherited, is an outside change"
New `sell/orders/search-empty.test.ts` (avoids the CONF-4 edits in `pages-views.test.ts`):
- "clearSearchHref drops q and page and keeps view, show and layout" · "clearSearchHref marks a view's own q cleared"
- "confirmation and shipping pass the search to table and board" · "no search passes nothing"

Live (throttled Slow 4G): type then Enter on a view pill; type then Reset; type then "Compact rows"; type then Save; status then typing.
Screenshots `docs/design/audit/CONF-1-F/`: no-match on confirmation and shipping, table + board, EN and AR, light and dark, 390 and 1280. No browser tool: say so in PROGRESS.md.

## Edge cases / assumptions
- Confirmed in code: all four review findings are still present. `SearchParamInput` is used only by the queue bar and Customers (Customers gets the same link cancel, no registry).
- D63 1b lists Save among changes that drop unsent text; the row and review-4 #2/#3 (D92) now have Save send it. This brief follows the row.
- Typing again after a link click, before the page arrives, arms a new write: accepted (D63 1b covers a loading page only once it opens).
- `hold` also happened to cover non-link buttons that change the address. On the queues these are Reset (marked), status/layout (merged) and view-menu actions (async, after the write). Not covered, as today: a row click (`?row=`) within 300 ms of typing.
- Search plus a status with nothing: "Clear search" keeps the status.
- CONF-4 (`claimed:codex`, same lane, unmerged) edits both confirmation files, `order-kanban.tsx` and adds a migration: whoever ships second merges `v3` by hand.
- Out of scope: backlog lows `pairKey` collision (review #4); a "no match" state for filters without a search.
