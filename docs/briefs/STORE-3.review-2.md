VERDICT: FIX

## Summary
Reviewers: qa-reviewer (risk high) + ui-reviewer (surface ui). Diff `git diff v3...v3-STORE-3`.
RLS/grants/triggers hold; live RLS suite 91 pass / 3 skip, tsc clean, i18n parity OK. Review-1 fixes 1, 2, 3, 5 confirmed.
Four mediums remain: invented per_variant discount, related cards bypassing the price rule, duplicated pickers in the preview, required screens still missing.
No owner decision needed; n=2 so FIX, not ESCALATE.

## Findings (ranked)

1. **MEDIUM — `src/lib/store/offer-price.ts:53` per_variant shows a discount that never existed.**
   When a size has `price_override` but no `compare_at_override`, `comparePrice` falls back to the product `compare_at_price`. Base 5000, compare 6000, S override 3000 → headline "3000, ~~6000~~, -50%". Same defect class as review-1 #5 (per_value).
   Fix: in per_variant, when `override !== null` use only `compareOverride` (null → no compare). Test: `compare below price hidden (all modes)` with override set + compare override null.

2. **MEDIUM — `src/lib/store/data.ts:283` related-product cards use raw `sale_price`, bypassing `offer-price.ts`.**
   A per_variant product with all overrides 7000 shows 5000 on the card and "from 7000" on its page. A product with every size unsellable is still listed and its link 404s.
   Fix: compute the card price with the same lowest-sellable-size helper; drop unsellable products. Add a test.

3. **MEDIUM — `src/components/store/product-view.tsx` + `order-form.tsx`: admin preview renders the size picker and the offer list twice** (static page blocks + the form's own radios). The top copies are inert and invite taps.
   Fix: render the static size/offer blocks only when the order form is absent (public "orders open soon" state).

4. **MEDIUM (coverage) — brief screens still missing (review-1 #4 open).**
   Committed: only `docs/design/audit/STORE-3/selling-dark-en-{390,1280}.png` (+ partial R2 captures). Missing: 1280 for store and preview; light+dark store; AR Selling tab; per_value / per_variant modes; no-sizes disabled switch; Selling error + skeleton; store page with 0 offers, 1 size, all sizes out of stock; preview with a submitted validation error. Also verify the store follows its own light default and not `prefers-color-scheme` (rendered dark under forced light emulation).

5. **LOW — `offer-price.ts:9-12` vs `piecesCharge` / `order-form.tsx:68`: mixed-size offer rule contradicts itself** (header says offer only with "same size" on; code applies it with `same=false`). Pick one rule, document it for STORE-4, test it.

6. **LOW — `offers-editor.tsx:59`: an existing bump whose product was deleted blocks every offer save** (review-1 #7 open). Treat `productId === null` as "no bump" on save.

7. **LOW — `selling/actions.ts:52-113`: offer save not atomic, and new rows keep `id: null` in client state** so every later save deletes and re-inserts them with new ids (review-1 #6 open). Must be fixed before STORE-4 stores offer ids on orders: transactional RPC returning ids, re-init client state.

8. **LOW — `selling/actions.ts:34-47`: `savePricing` writes row by row and returns on first error before `updateTag`**, so the store can show new deltas with the old mode for up to 120 s. Invalidate in a `finally`, or move to one RPC.

9. **LOW — `number-field.tsx` `integerInput`: "2500,00" becomes 250000.** Refuse (`aria-invalid`) when `.`/`,` is followed by digits.

10. **LOW — `offers-editor.tsx:87`: editor saving uses `salePrice`, store judges against the cheapest size**; an offer shown as "saves 1000" can be hidden on the store in per_value/per_variant.

11. **LOW — preview summary shows "Starting from 5 000 DZD" for a uniform product**; brief limits it to per_variant (show only when sizes differ in price).

12. **LOW — `order-form.tsx`: wilaya `<select>` is `aria-invalid="true"` before any input.** Set it only after a failed submit or blur.

13. **LOW — Selling form editor: all label inputs show placeholder "Default label (Arabic)"** instead of the real default text (review-1 #9 open).

14. **LOW — `selling/page.tsx:31` loads every `product_variants` row in the workspace.** Filter to candidate products.

15. **LOW (verify) — Selling tab switches/checkboxes and offer up/down/delete icon buttons**: confirm each has an accessible name.

16. **LOW — store offer rows are not selectable and nothing says offers apply at checkout** (review-1 #10 open).

17. **INFO — offer windows can lag up to 120 s (page `revalidate 120`).** Acceptable.

## Missing tests
- `price change shows next request`: nothing asserts the selling actions call `updateTag('store-public')`.
- `product save with sale above compare ok`: only a direct service-role update; not through `products/actions.ts`.
- `compare below price hidden (all modes)`: per_variant with override set + compare override null (finding 1).
- Related cards use the shared price rule and drop unsellable products (finding 2).
- Offer ids stable across two saves; a deleted bump product does not block save (findings 6, 7).
- Mixed-size offer rule (finding 5).
