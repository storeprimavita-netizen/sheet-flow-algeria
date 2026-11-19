VERDICT: ESCALATE
## Summary
Round 3 (n ≥ 3) still has 4 medium findings, so this goes to the owner. The DB core is correct. A rolled-back replay of 00050 on a DB with orders gave the right order, left `updated_at` alone, left no gaps, set the counters to max+1, and kept the grants and RLS locked down. Review-2 #4–#6 are fixed. Gate OK (520 passed, 3 skipped, live RLS suite on). The palette empty-state fix passes in a browser.
Still open: the keyboard focus still draws two rings, the frozen divider disappears when the table scrolls, the fallback test is fake, and the required swap/createOrder/webhook/search-error tests are missing (same as review-2 #3).
Owner: send it back for another FIX round (the fixes are small and clear), or accept the UI items and only require the tests.

## Findings (ranked)

1. **MEDIUM — `src/components/data-table/data-table.tsx:251-253`: keyboard focus still draws two rings.**
   - The `<table tabIndex={0}>` has no `outline-none`, so the browser's default outline (`rgb(0,95,204) auto`) draws on the table edge, next to the row ring `ring-2 ring-inset ring-ring` at :339.
   - Screenshots: `docs/design/audit/ORD-1/r3-focus-en-dark.png` and `r3-focus-ar-light.png`.
   - Fix: add `focus-visible:outline-none` on the table so the row ring is the only indicator.
2. **MEDIUM — `data-table.tsx:252/277/359`: the frozen-column divider disappears when the table scrolls.**
   - The table uses `border-collapse`. Collapsed borders belong to the table grid, so a `border-e` on a sticky cell does not move with it.
   - The border token is also only about 12% alpha.
   - Screenshots `r3-scrolled-en-dark.png` and `r3-scrolled-ar-light.png` show customer text bleeding at the frozen edge with no line, and a stray "st" next to `#0059`.
   - Fix: use `border-separate border-spacing-0`, or draw the divider on the sticky cell itself (an inset shadow or pseudo-element on the logical end side, mirrored in RTL), with a visible token.
3. **MEDIUM — `src/lib/orders.order_seq.rls.test.ts:123-130`: the fallback test does not test the fallback.**
   - It inserts 2 orders and checks the counter is 3, which the normal path already covers.
   - The project already runs SQL from tests through the `psql()` helper in `src/lib/variants.rls.test.ts:176`.
   - Fix: use `psql()` to delete the workspace's `order_counters` row, insert twice over REST, and assert seq = max+1, max+2 and counter = max+3.
4. **MEDIUM — tests the brief requires are missing (brief "Tests", review-2 #3, still open):**
   - `swap_order`: the replacement order gets the next seq. `stock-stages.test.ts` calls it but never reads `order_seq`.
   - Manual `createOrder` (`src/app/(app)/app/orders/actions.ts:360`) gets a seq.
   - Webhook insert (`src/lib/webhook.ts:290`) gets a seq, and a replay of the same event does not use up a number.
   - The `orders/all` search error path (`src/app/(app)/app/orders/all/page.tsx:95`) shows the error state with a working retry.
5. **LOW — `orders.order_seq.rls.test.ts:136-138`: the ON CONFLICT test cannot fail.**
   - The `upsert` error is never checked, and `toBeGreaterThanOrEqual(2)` is already true after the first insert.
   - Fix: assert `error` is null and the counter equals 3 (on the DB it does burn a number, as `docs/DB.md` says).
6. **LOW — `data-table.tsx:339` vs `:359`: the focused row's inset ring is painted under the opaque sticky cell**, so it looks thinner across the frozen column. Fix together with #1, for example with a per-cell outline or a pseudo-element.
7. **LOW — `orders-all-table.tsx:104`: the CSV header `"Order"` is hardcoded English.** The values correctly use `formatOrderNo`. Fix: use a translation key.
8. **LOW — `scripts/db-reset.sh:16-19`: the readiness loop gives up silently after 30 s.**
   - Fix (optional): print "PostgREST not ready" before seeding.
   - The script is otherwise safe and local-only: `.env.local` passes the localhost check and the reset uses `--local`.
   - The `seed-dev.ts` changes are correct: the select error now throws, the `SEED-` numbers are gone, and one order keeps `#SH-1001`.

## Verified OK
- 00050 replay with existing orders (ties, NULL `placed_at`, a `created_at` tie broken by id), run in a transaction and rolled back.
  - Backfill matches an independent `row_number()`, with 0 rows' `updated_at` changed.
  - Counters: an empty workspace gets 1. With the counter row deleted, the fallback gives the next numbers.
  - An unknown workspace fails with 23503. Changing `order_seq` fails with 42501.
- `order_counters`: RLS on, 0 policies, no grants for anon or authenticated. Execute on both security-definer functions is revoked.
- Every UPDATE trigger on `orders` does nothing when only `order_seq` changes, so the backfill is safe on a DB with swaps or statuses.
- Palette (`command-palette.tsx:89`): with an empty query only Navigate shows, and with a query no stray "No results" appears. Checked in AR light and EN dark. `#0001` stays LTR inside AR.
- The frozen cell tint follows `--row-bg` on hover and focus in both themes.

## Not covered (by the UI reviewer)
- Order sheet and order page: the sheet did not open from a row click, so these were only checked in code.
- Width 390 px.
- The delivery and product-orders frozen tables.
- AR dark and EN light.
- Agent session.
- Escape and focus return on the palette.

## Missing tests
- The fallback, through `psql()` (#3).
- `swap_order`, `createOrder` and webhook insert each get a seq, and a webhook replay does not use up a number (#4).
- The `orders/all` query error shows the error state and retry (#4).
- The ON CONFLICT test asserts the counter equals 3 (#5).
