VERDICT: FIX

## Summary
RLS, grants, DTO hygiene (no cost/sku/stock/free_delivery), bump FK rules, one-default index and the "no public submit" rule all hold; the live suite passes (100 passed, 3 skipped).
Three medium correctness defects in prices on the public page and one in the shared number field. The ui-reviewer could verify only the Selling tab (dark, EN, 1280); the store page and the admin preview screens are unverified because the local seed has no store.
Reviewers: qa-reviewer (risk high) and ui-reviewer (surface ui). Diff: `git diff v3...v3-STORE-3`.

## Findings (ranked)

1. **MEDIUM — `src/components/fields/number-field.tsx:66`. Integer mode strips the dot, it does not refuse it.** `raw.replace(/[^\d]/g, "")` turns "2500.00" into 250000 and "2500.5" into 25005. This affects the per-size override, the compare price, the offer total and the bump price; the wrong price reaches the store on the next request. Fix: in integer mode, keep the part before the decimal point (or refuse it and set `aria-invalid`). Never join the digits. Add a unit test for "2500.00" → 2500.

2. **MEDIUM — `src/lib/store/data.ts:118`. Products with sizes never show the crossed-out price.** `compareAt` is computed only when `!hasSizes`, and `product-view.tsx` reads only `dto.product.compareAt`. Example: an abaya in S/M/L at 5000 uniform with compare 6000 shows no crossed-out price on the public page. Fix: take the product-level compare from the cheapest sellable size, using `comparePrice` for that size. Test: sized product, compare > price → compareAt shown.

3. **MEDIUM — `src/lib/store/data.ts:116` and `src/app/(store)/s/[store]/[slug]/page.tsx:40`. A product whose sizes are all unsellable is published with no price.** When every size has a unit price <= 0, `unit` is null. The page then shows "—" and "orders open soon", and the JSON-LD contains `"price": null`. Before this change, a product with no price returned 404 (existing test "no price 404"). Fix: when `hasSizes && unit === null`, `loadPublicProductPage` returns null (404). Test it.

4. **MEDIUM (coverage) — the store-page and admin-preview screens required by the brief are unverified.** The brief lists these screens: store page with offers, "orders open soon", 0 offers, 1 size and out of stock; admin preview with a validation error; each at 390 and 1280, light and dark, AR and EN. None of them was captured, because the local seed has no store. `store.css` also changed every store grid from `@media` to `@container` (`container-type: inline-size` on `.store-main`). That change reaches all public store pages, and nobody has tested it. Fix: seed a published store and product page locally (in `scripts/seed-dev.ts` or a documented local step), then capture the brief's screen list. Check the 2-column product layout and the 4-column related grid at 390, 860 and 1280 px in AR and EN.

5. **LOW — `src/lib/store/offer-price.ts:54-57`.** In per_value mode the crossed-out price ignores the size's delta. With sale 5000, compare 6000 and S at -1000, S shows 4000 next to a struck 6000, which overstates the discount. Fix: add the delta to the compare price in per_value mode.

6. **LOW — `src/app/(app)/app/products/[id]/selling/actions.ts:61-111`.** `saveOffers` is not atomic. It runs delete, clear default and upsert as separate calls, so a failure in the middle leaves a partial list with no default. An update with an id that matches 0 rows still returns ok. Offers with `id: null` get a new id on every save, which STORE-4 will care about once orders store an offer id. Fix: one transactional RPC that returns the ids and fails when an update matches 0 rows. It can wait until STORE-4, but it must be resolved before orders reference offer ids.

7. **LOW — `offers-editor.tsx:58`.** A bump whose product was deleted (`productId: null`) blocks every offer save with `bumpIncomplete`. Show it as "product removed" with a clear remove action.

8. **LOW.** `is_default` is not in the DTO and is never preselected. Expose it, or document it as admin-only. `bump_price` has no upper limit; consider capping it at the bump product's price.

9. **LOW (UI).** Selling tab, Order form section: all seven label inputs show the placeholder "Default label (Arabic)", which is noisy. The contrast of "Always required" is unchecked in light mode. The "Crossed-out price" field has no example. In `order-form.tsx` (~L202), the `aria-live` summary re-announces on every selection; announce only the total. `onBlur` revalidation (~L140) can show a size error early.

10. **LOW (UI).** The public page lists offers as plain text that a visitor cannot select until STORE-4. Make sure the copy says that offers apply at checkout.

11. **INFO.** `src/lib/variants.rls.test.ts:114` was loosened so that agents can see `price_delta`, `price_override` and `compare_at_override`. Agents already see `sale_price`, so this is acceptable, but the owner should know about the test edit. `products` has no audit trigger, so `pricing_mode` and `compare_at_price` changes are not audited; this was already the case before the branch.

## Missing tests
- `price change shows next request`: nothing checks that the three selling actions call `updateTag('store-public')`.
- `product save with sale above compare ok`: tested only as a service-role update (`offers.rls.test.ts:152`), never through `products/actions.ts`.
- Sized product with compare > price shows compareAt (finding 2).
- All sizes unsellable → 404 (finding 3).
- Integer number field with "2500.00" (finding 1).
- The `bump` key-set is missing from the DTO key-set snapshot.
- Screens: see finding 4. Unverified on the Selling tab: light mode, AR/RTL, a true 390 px viewport, the per_value and per_variant modes, the no-sizes disabled switch, the error state and the loading skeleton.
