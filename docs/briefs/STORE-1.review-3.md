VERDICT: ESCALATE

## Summary
Third diff review with no PASS, so this goes to the owner (n ≥ 3 rule). Review-2 #1 and #3–#11 are fixed. The RLS suite passes live, 21 of 21.
Review-2 #2 is only partly fixed. A stale tab can still commit sizes that are missing a value for one option, and after that the editor can never save again (medium).
The UI review found one medium: keyboard focus is lost after Escape on the deactivate dialog. No new tests were added for the review-2 fixes.
Owner decides: (a) one more FIX round with the cheap guard, the focus return and the tests, or (b) the full single-transaction RPC from review-2 #2 now.

## Findings (ranked)

1. **Medium (correctness/integrity): `src/app/app/products/actions.ts:244-245` (`saveVariantConfig`).**
   - The guard refuses an option that is *new* once sizes exist. It does not refuse a payload that is *missing* a stored option.
   - Failure, reproduced by qa-reviewer in a rolled-back transaction:
     1. Tab A opens the editor with Size [S, M] and no sizes.
     2. Tab B adds Color [Red] and saves the sizes S/Red and M/Red.
     3. Tab A saves sizes S and M.
     4. The guard passes. The join insert `{Size: S}` passes the duplicate-set check, because {S} is not {S, Red}.
     5. Only then does the Color delete fail with 23503 (`in_use`).
   - Committed result: active sizes "S" and "M" with one value each on a product that has two options. Stock is split between "S" and "S / Red".
   - On reload, `variantConfigSchema` (`variant_values` length !== options length) rejects the stored state. The editor can never save again, so those sizes cannot even be deactivated.
   - A size with zero values breaks the editor the same way. That happens when the process dies between the size upsert and the join insert, or when the cleanup delete fails (its error is ignored).
   - Concurrent saves also have a window between the guard's read and the writes.
   - Fix, minimum:
     - When any size has values, refuse unless the payload's option ids equal the stored option ids exactly.
     - Make the loader and editor tolerate a partial size: show it as "incomplete" and allow deactivating it.
   - Fix, proper: one security-invoker plpgsql RPC for the whole save, plus a deferred constraint trigger checking that every size has exactly one value per option of its product.

2. **Medium (a11y/keyboard): `src/app/app/products/_components/variants-editor.tsx:270`.**
   - The deactivate dialog is controlled and has no Trigger. On Escape or Cancel, Radix has nothing to return focus to, so focus drops to `<body>` and keyboard users restart from the top of the page.
   - Fix: add `onCloseAutoFocus` (with `preventDefault`) that focuses that row's `data-fk` deactivate button. The editor already has the `focusKey` mechanism for this.

3. **Low: `saveVariantConfig`, partial commits.** Writes are not in one transaction:
   - Option renames and value/size upserts are committed before a later step fails.
   - A stale tab retries the same failing `in_use` drop until the page is refreshed.
   - A stale tab overwrites other admins' `sku` and `is_active` edits.
   - The RPC from finding 1 fixes all three.

4. **Low: `actions.ts:250`, swapping two value labels fails.** Swapping two labels (S↔M) in one save fails with `duplicate_value`, because `product_option_values_label_uniq` is checked row by row. Fix: make the unique constraint deferrable, or park the labels first, inside the RPC.

5. **Low: `src/app/app/stock/stock-controls.tsx:33`, no error handling on submit.** `addStockMovement` is not wrapped in try/catch, so a refused movement throws an unhandled error instead of showing a toast. This was already true before STORE-1.

6. **Low: `src/app/app/products/[id]/stock/page.tsx`, stock page at 390 px in AR.**
   - The movements table overflows: the Note header is clipped and the reason pill wraps over 3 lines. Fix: wrap it in `overflow-x-auto`.
   - The size select on the adjust form is truncated ("…موزّع على مقاس").

7. **Low: `count-by-size.tsx`, unlabeled counts (review-2 #14 still open).** Each row shows a bare current count ("0S"). Label it ("Now:") or use the column layout of the stock-by-size table.

8. **Low: `variants-editor.tsx`, mobile layout and keyboard extras.**
   - At 390 px the option-name row wraps awkwardly: the up arrow sits on one line, delete and down wrap to the next.
   - Enter in a value input does nothing (optional: add the next value).
   - Icon targets are 36 px, which matches app-wide icon buttons.

## Verified fixed since review-2
- Review-2 #1, #3, #4, #5, #6, #7, #8, #9, #10, #11, #15, #16.
- Keyboard tab order follows the visual RTL order, and the focus ring is visible.
- No hardcoded colors or emoji. Money is shown in DZD with separators.
- Screenshots: `docs/design/audit/STORE-1/r3-*.png`.

## Not verified by the UI review
- The order-form size picker and the change-size card were not exercised.
- No full light-theme pass was done.
- The builder's own screenshots (`r3-*`) must cover these before ship.

## Missing tests
- `saveVariantConfig` must refuse a stale payload that is missing an option (finding 1).
- `saveVariantConfig` must refuse a new option after sizes exist.
- `saveVariantConfig` must refuse ids from another product or workspace.
- `saveVariantConfig` must leave no size without values after a duplicate-set cleanup.
- `saveVariantConfig`: deactivating and reactivating a size.
- `apply_stock_movement` lock order: a count running alongside an order movement in two sessions, with no 40P01 deadlock.
- Label trigger: a direct PATCH of `orders.variant` while `variant_id` is set gets rewritten from the variant.
- Still open from review-2:
  - `changeOrderVariant` from an admin session.
  - Changing the size at the reserved, `stop_desk_waiting` and `delayed` stages.
  - The picker resets, and an inactive size is hidden on new orders.
