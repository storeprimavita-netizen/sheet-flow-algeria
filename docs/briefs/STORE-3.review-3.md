VERDICT: ESCALATE

## Summary
Diff review #3 (qa-reviewer + ui-reviewer). Review-2 #1, #2, #3 and #6 are fixed. RLS live suite: 110 pass, 3 skip. Writes are admin-only with USING + WITH CHECK, and anon has no grant.
Two medium findings are still open: a sizeless product priced 0 goes live with no price, and the brief's screen matrix is still not captured. It also shows the quantity offers as inert rows in the "orders open soon" state.
This is the third diff review without a PASS, so the loop rule escalates it. The owner chooses between another FIX round, or shipping with findings 1-3 fixed and 4-11 sent to STORE-3.followups.md before STORE-4.

## Findings (ranked)

1. **MEDIUM: a sizeless product priced 0 is published with no price.** `src/lib/store/data.ts:160` (`sellable: !(hasSizes && unit === null)`), `:122`.
   - `products.sale_price` has no CHECK, and `products/actions.ts:34` accepts `min(0)`. With `sale_price = 0` and no sizes, `unitPrice` returns null.
   - The page renders "—" and the JSON-LD has `"price": null`.
   - The related-card path (`data.ts:~292`) drops the same product, so the two paths disagree. This breaks the brief rule "unit price <= 0 => refused".
   - Fix: `sellable: unit !== null`. Test: a sizeless product with `sale_price: 0` returns 404.

2. **MEDIUM: the brief's screen list is still not captured (review-1 #4, review-2 #4).** `docs/design/audit/STORE-3/`.
   - `store-light-1280.png` and `store-osdark-1280.png` are byte-identical (same md5), so dark emulation never applied.
   - Still missing:
     - Selling tab: AR, per_value and per_variant modes, the no-sizes disabled switch, the error state, the skeleton.
     - Store page: 0 offers, 1 size, all sizes out of stock.
     - Admin preview: with a validation error, and at 1280.
   - The reviewer captures in `STORE-3-r3/` cover 390 AR only.

3. **MEDIUM (UI): quantity offers look selectable but are inert in the "orders open soon" state (review-1 #10).** Store page, `product-view.tsx`.
   - The rows under "اختاري الكمية" ("choose quantity") look like choices, but nothing happens on tap and nothing says the offers apply at checkout.
   - Fix: a one-line hint ("offers apply in the order form"), or hide the picker styling until STORE-4.

4. **LOW: switching mode says the deltas are discarded, but they persist.** `selling/_components/pricing-editor.tsx:54,82`.
   - `pick()` zeroes the deltas, so `hasDeltas` becomes false and `save()` sends `deltas: []`.
   - The old non-zero `price_delta` rows stay in the DB and come back on the next switch to per_value.
   - Fix: send the zeroed deltas whenever the mode leaves per_value.

5. **LOW: the mixed-size offer rule contradicts itself (review-2 #5).**
   - The header at `offer-price.ts:9-13` says the offer applies only with "same size" on.
   - `order-form.tsx:68` applies `piecesCharge` whatever the value of `same`.
   - Pick one rule, document it for STORE-4, and test it.

6. **LOW: `integerInput("2500,00")` returns 250000 (review-2 #9).** `src/components/fields/number-field.tsx:14` splits only on ".". On an AR/FR keyboard a price becomes 100 times too high. Fix: split on `[.,]`.

7. **LOW: offer save is not atomic, and offer ids churn (review-2 #7).** `selling/actions.ts:52-113`, `offers-editor.tsx:31`.
   - New rows keep `id: null` in client state, so every save deletes and re-inserts them with new ids.
   - Two concurrent saves can leave duplicate quantity offers.
   - Fix: a transactional RPC that returns the ids. This must be done before STORE-4 stores offer ids on orders.

8. **LOW: `savePricing` returns on the first row error before `updateTag` (review-2 #8).** `selling/actions.ts:34-47`. The store can show new deltas with the old mode. Fix: make it atomic (RPC), or always invalidate.

9. **LOW: the offer saving does not follow the chosen size.** `order-form.tsx:160`.
   - The offer label shows the saving at the cheapest size; the summary recomputes it for the size actually chosen.
   - Example: sizes S 5000 and XL 7000, offer 2 for 9000. The label says "save 1000", the summary for 2×XL says 5000.
   - Fix: recompute the label for the selected size.

10. **LOW: related cards run 4 queries each, up to 24 per uncached render.** `data.ts:~287`. Fix: batch the queries.

11. **LOW (note): app chrome at 390 in the preview has targets under 44 px.** Search is 32 px, "Edit page" 32 px, breadcrumbs 16 px. This is app chrome, not store, so it is not blocking.

## Missing tests (brief acceptance list)
- `price change shows next request`: no test checks that the selling actions call `updateTag('store-public')`.
- `product save with sale above compare ok`: tested only by a direct service-role update, never through `products/actions.ts`.
- A sizeless product at price 0 returns 404 (finding 1).
- Leaving per_value clears the deltas in the DB (finding 4).
- Offer ids stay stable across two saves (finding 7).
- The mixed-size offer rule (finding 5).
