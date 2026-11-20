risk: high · surface: ui,security · lane: store

Source: `docs/briefs/STORE-1.review-4.md` (findings 2-8) + `STORE-1.review-2.md` lows 12-14, 18, 19, D40/D55/D56. Paths drifted: app is `src/app/(app)/app/...`.
Goal: close the STORE-1 leftovers: DB hardening in one migration, test-cleanup through `test-cleanup.ts`, and the small order/product/stock UI fixes.
Done when (checkable):
- `00065_variant_config_hardening.sql` applies locally; types regenerated (function signature unchanged, so likely no diff); `docs/DB.md` notes it.
- The completeness trigger takes `pg_advisory_xact_lock(hashtext(product_id::text))` first.
- A save that removes a value and re-adds the same label succeeds.
- `save_variant_config` refuses a NEW size whose values map lacks a key per option (keys <> option count), and refuses a size with a value set that does not match the options.
- Reserved-stage test uses confirmed + `wait_for_deposit`; the old one stays, relabelled "on-road (bureau_deposited)".
- No `workspaces`.delete() left in `cash.test.ts:49-50`, `audit-redact.rls.test.ts:46`, `stock-stages.test.ts:266` (all via `deleteWorkspaces`).
- UI items below fixed; gate green 3x in a row (`--fast`).

Files
1. `supabase/migrations/00065_variant_config_hardening.sql` (next number after 00064). `create or replace` both functions of 00048 (same grants; the function stays security invoker, search_path pinned). No new table, so no RLS/DB.md table work.
   - Trigger fn: lock first line. Caution: it fires per row, the lock is reentrant in one tx; fine.
   - Save fn: move the two `delete`s (values, then options) to right after "park labels", before the upserts. Order matters: delete of a value still used by a size must still refuse (`in_use`, FK), keep that test green. Then, before the variant insert: for each payload variant whose id has no existing row, `jsonb_object_keys` count must equal option count in payload, and every key must be a payload option id, else `raise exception 'incomplete size'` (map to an error code in `actions.ts`).
2. `src/lib/variants.rls.test.ts`: tests: re-add same label in one save; empty `values: {}` for a new size refused; two-writer race not reproducible in-test, assert the lock via `pg_locks` is not needed (skip, state so); reserved-stage test at ~line 480 (confirmed + `wait_for_deposit`, assert held moves M to L); call the real `changeOrderVariant` action is not possible in vitest, keep the admin-session update and say so. Use the file's helpers (`status`, `buy`, `order`, `pstock`, `vstock`).
3. `src/lib/cash.test.ts`, `src/lib/audit-redact.rls.test.ts`, `src/lib/stock-stages.test.ts`: replace workspace deletes with `deleteWorkspaces(svc, ids)` from `src/lib/test-cleanup.ts` (it empties seasons first, retries 40P01). Do not edit `vitest.config.ts` or the gate.
4. `src/app/(app)/app/orders/[id]/page.tsx`: move `<VariantCard>` up next to the summary (right after the duplicate warning, before `OrderTaxonomyCard`); 19 "New order breadcrumb": add the same breadcrumb pattern other pages use if `PageHeader` supports it, else skip and note.
5. `.../orders/[id]/variant-card.tsx:64-67`: Field label `orders.sizeLabel` ("Size"/AR), keep placeholder `orders.chooseSize`; the list item no longer repeats it (no item with that text).
6. `.../products/_components/variants-editor.tsx`: fallback name `option N` for aria labels at lines 134-140, 175 (`removeOption`, `moveOption*`, `addValue`); stale message gets `role="alert"` (see line ~269 pattern). 12: show an "unsaved options and sizes" hint when `dirty` and make the product Save hint that sizes save separately (`product-form.tsx`). 13: notice on `/products/new` "add sizes after the first save" (`product-form.tsx`).
7. `.../products/[id]/stock/count-by-size.tsx`: label the bare count ("Now:") or column headers. 18: `src/app/(app)/app/stock/page.tsx:82` "Count needed" pill `whitespace-nowrap`.
8. `src/messages/{en,ar}.json`: all new strings, key parity.

Steps (each pushed with step.sh)
1 migration + test cases 2 -> 2 test-cleanup swaps -> 3 order page + variant card -> 4 editor a11y/hints + new-product notice -> 5 count-by-size + pill -> 6 i18n/screenshots/PROGRESS.

Acceptance tests (in variants.rls.test.ts): "re-adding a removed label in one save succeeds"; "a new size with empty values is refused"; "size change at reserved (wait_for_deposit)"; existing "in_use rolls back", "stale", completeness tests unchanged. Run live RLS suite.
Screenshots (dark+light, EN+AR, 1280 and 390): order detail (Size card position, one "Size" label), product edit (hints, unnamed option buttons via snapshot names), `/products/new`, stock hub row, count-by-size.

Edge cases: lock key must match the save fn (same hashtext of product id) so both queue; moving deletes earlier must not drop a value a size still uses (FK still refuses); a payload size with partial keys vs existing size: existing sizes are untouched (values never change).
Assumptions: D56 retry already done and replaced by `deleteWorkspaces`; reviews #1 closed. Not reproducible race (#2) is covered by reasoning only. No new DECISIONS row needed.
