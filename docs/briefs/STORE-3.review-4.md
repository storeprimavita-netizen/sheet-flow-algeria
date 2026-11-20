VERDICT: ESCALATE

## Summary
Diff review #4, the last round under D61, by the qa-reviewer and the ui-reviewer. Gate OK with the live suite: 568 pass, 3 skip. There is no high finding. D61 points 1, 2, 3 (code), 4 and 7 are done, and the round stayed in scope (no migration, no RLS or DTO change).
The point-5 screens were captured this round by the ui-reviewer under `docs/design/audit/STORE-3/r4-*`. The 1280 dark capture is real (its md5 differs from light).
Two mediums are still open: the point-3 live test is missing, and an all-sizes-out product shows no sold-out state. The rule makes this ESCALATE, because n ≥ 3 without a PASS. Per D61 (6): gate OK and no high finding → merge under D40, and the findings below go to `STORE-3.followups.md`.

## Findings (ranked)

1. **MEDIUM: the live test D61 point 3 asks for is missing.** `src/app/(app)/app/products/[id]/selling/_components/pricing-editor.tsx:83`.
   - The code always sends every delta, 0 outside per_value. The qa-reviewer read this in code and the ui-reviewer confirmed it; neither ran the save.
   - But no test saves per_value with a delta, then saves uniform, then checks that the `price_delta` rows are 0. It is only listed as missing in the followups file.
   - If someone restores `|| hasDeltas`, the confirm dialog lies again and nothing catches it.
   - Fix: move the payload builder into a pure exported function and unit-test it (uniform or per_variant → every delta is 0). Add the live action test.

2. **MEDIUM (UI): an all-sizes-out product has no sold-out state.** Screen `r4-store-light-390-alloos.png`; rule in `src/lib/store/variant-stock.ts`.
   - Every size is struck out, but the quantity offers still render as normal rows, under "orders open soon / come back later". Nothing says the product is sold out.
   - The D58 stock rule also counts a size as in stock while the product's unassigned stock is above 0. The Selling tab gives the admin no hint about this.
   - Fix: when `every(!inStock)`, show a sold-out line and hide the offers. Add a Selling-tab hint about unassigned stock.

3. **LOW: the `offer-price.ts` header still says "same size".** `src/lib/store/offer-price.ts:9` says "`qty` pieces of the same size", while lines 11-14 now say the offer applies whatever the sizes. STORE-4 starts from this header. Fix: "`qty` pieces of this product".

4. **LOW: publishing accepts a product nobody can buy.** `src/app/(app)/app/store/actions.ts:146-147` refuses only `sale_price === null`.
   - A product with no sizes priced 0, or one whose sizes are all unsellable, publishes with a success message. Visitors then get a silent 404 (point 1).
   - Fix: use the same `unit !== null` check in the publish guard.

5. **LOW: the point-1 404 returned status 200 once in dev.** The first request, while dev was compiling, returned 200 with the 404 body; later requests returned 404. This is probably a dev streaming artifact. Verify with one curl on a production build.

6. **LOW (UI): the "save 23%" badge is low contrast in dark.** It is pink text on a dark pink fill on the store. This was judged by eye, not measured. Check that it reaches 4.5:1.

7. **LOW (UI): the AR save error is masculine.** «تعذّر الحفظ. حاول مجدّدًا» is masculine, while the store copy is feminine («عودي»). The error does give a reason and a retry button.

8. **LOW (note): app chrome targets under 44 px on the Selling tab at 390.** There is no horizontal scroll, and the tab row scrolls. This is not blocking (same as review-3 #11).

## Missing tests
- Leaving per_value sets every `price_delta` row to 0 in the DB (finding 1).
- Publish is refused for a product priced 0 or with no sellable size (finding 4).
- Still open from the followups file: the selling actions call `updateTag('store-public')`; a sale price above the compare price saved through `products/actions.ts`.

## Screens (D61 point 5, by the ui-reviewer)
All under `docs/design/audit/STORE-3/`:
- Store page:
  - `r4-store-light-1280.png`
  - `r4-store-dark-1280.png`
  - `r4-store-light-390-nooffers.png`
  - `r4-store-light-390-onesize.png`
  - `r4-store-light-390-alloos.png`
- Selling tab:
  - `r4-selling-ar-light-1280.png`
  - `r4-selling-ar-dark-390.png`
  - `r4-selling-per-value-light-1280.png`
  - `r4-selling-per-variant-light-1280.png`
  - `r4-selling-nosizes-disabled-light-1280.png`
  - `r4-selling-save-error-light-1280.png`
- Admin preview:
  - `r4-preview-error-dark-390.png`
  - `r4-preview-error-light-1280.png`

The 390 light and dark captures with offers are the earlier `STORE-3-r3/` files. The skeletons were read in code: `loading.tsx` exists for the store page and for the Selling tab. No hardcoded colours, emoji or cost fields appear on any screen.
