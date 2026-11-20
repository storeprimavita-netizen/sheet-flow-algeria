VERDICT: ESCALATE

## Summary
Diff review #5 covers `3d2a851..HEAD` without the P1-7 merge. Both reviewers ran. GATE OK with the live suite after a clean `scripts/db-reset.sh`: 620 pass, 3 skip.
Merge check: types regenerated from the reset DB (now at 00055) are byte-identical to `database.types.ts`, and 00052–00055 touch no table that 00051 uses.
The sold-out state works live. AR was checked at 390 light and 1280 dark: offers are hidden and a sold-out card replaces the order block. There is no high finding.
Two mediums remain, both small. The live test does not call `savePricing`, and the Selling-tab unassigned-stock hint was deferred. Round 5 has no PASS and n ≥ 3, so the rule says ESCALATE. Gate OK and no high: merge under D40 (as in D61 (6)) and move the items below to `STORE-3.followups.md` / STORE-3-F.

## Findings (ranked)

1. **MEDIUM: the D61 (3) "live test" copies the action's writes and does not call the action.** `src/lib/store/offers.rls.test.ts:139-154` against `src/app/(app)/app/products/[id]/selling/actions.ts:34-37`.
   - The qa-reviewer ran two mutations in a throwaway worktree:
     - `buildPricingPayload` always sending the delta: caught by both the unit test and the live test.
     - `savePricing` writing deltas only in per_value (`for (const d of v.mode === "per_value" ? v.deltas : [])`): the suite still passes (619 pass, 4 skip). Uniform then leaves the old `price_delta` in the DB, which is the wrong-price bug D61 (3) exists to prevent.
   - `pricing-editor.tsx:80` going back to an inline payload is also untested.
   - The shipped code is correct today. This is a regression gap only.
   - Fix: call `savePricing` in the live test, using the `fees-actions.test.ts` pattern (mock `@/lib/supabase/server` `createClient` to return the `adminA` session, mock the role guard and `next/cache`). Assert that per_value → uniform and per_value → per_variant both leave every `price_delta` at 0.

2. **MEDIUM (UI): the Selling-tab hint about unassigned stock was not added** (the second half of review-4 #2). It was deferred in `docs/briefs/STORE-3.followups.md:14`.
   - The D58 rule (`src/lib/store/variant-stock.ts`) counts every size as in stock while `products.stock` is above the sum of the variant stocks.
   - The admin can strike a size to 0 and still see it buyable, with no explanation on the Selling tab.
   - Fix: when `product.stock - sum(variant stocks) > 0`, show one line on the Selling tab, e.g. "N pieces are not assigned to a size; every size counts as in stock until they are assigned" (EN + AR).

3. **LOW: migration 00051 is now older than 00052–00055, which are already on v3, and the owner has not been told.** `docs/briefs/P1-7.md:3` requires "merge STORE-3 first or flag the out-of-order push to the owner".
   - On a DB that already has 00055, `supabase db push` refuses 00051 unless run with `--include-all`. A fresh reset works.
   - Fix: add a line for the owner in DB.md or QUESTIONS, or renumber to 00056 before the merge.

4. **LOW: sold-out covers sized products only.** `src/components/store/product-view.tsx:37`: `soldOut = variants.length > 0 && every(!inStock)`.
   - This is correct under D58.
   - A product without sizes and with `stock <= 0` still shows "orders open soon".
   - The JSON-LD (`page.tsx:40`) has no `availability`.
   - STORE-4 must reuse one shared check, not add a second formula.

5. **LOW: the sold-out card also replaces `orderSlot` in the admin preview** (`product-view.tsx:115-126`). The admin cannot preview the form for an all-sizes-out product. This is probably intended; state it in the followups file.

6. **LOW (UI): the sold-out card has no dedicated render test.** The qa-reviewer cites `order-form.test.tsx:69` as the cover; the ui-reviewer found no `soldOut` case in `src/components/store/*.test.tsx`. Fix: add an explicit test with every variant out of stock (offers hidden, card shown).

7. **LOW (UI): the dark "save 23%" badge is still low contrast** (carried over from review-4 #6). Measure it and reach 4.5:1.

8. **LOW (UI, note): out-of-stock sizes are shown only as struck-out chips.** The "غير متوفر" text is there for screen readers, but there is no visible label.

## Missing tests
- `savePricing` called on a real admin session: per_value → uniform and per_value → per_variant (finding 1).
- A sold-out render test (finding 6). A product without sizes and with stock 0 on the public page (finding 4).
- Still open from the followups file: publish refused when no size can be sold; the selling actions call `updateTag('store-public')`; a sale price above the compare price saved through the product action.

## Review-4 items
- #1: closed at the payload-builder level (unit test plus a DB-level test). The action-level gap is finding 1.
- #2: the sold-out line and hidden offers are done and verified live. The hint is finding 2.
- #3: the header comment is fixed.
- #4–#7: moved to followups.

## Screens (ui-reviewer, live)
Under `docs/design/audit/STORE-3/`:
- `r5-review-light-390-ar-soldout.png`
- `r5-review-dark-1280-ar-soldout.png`

Neither has horizontal scroll (scrollWidth 390). EN, light 1280 and dark 390 were not captured live; the copy comes from the same component.
A stale EN capture taken before the 120 s cache expired was deleted.
Local DB note: the ui-reviewer set `abaya-luxe`'s stocks to 0 (it is now unpublished). Re-seed before the next browser run.
