VERDICT: FIX

## Summary
Round 2: qa-reviewer (diff + rolled-back SQL probes) and ui-reviewer (app run, chrome-devtools at 390 px and 1280 px). No high findings. RLS, the composite FK, the audit trigger and the anon revoke all held under the probes. 75 tests pass. Round-1 items 1-3, 5, 7-12 are fixed; 4, 6 and 13 are only partly fixed.
Five mediums block PASS: invalid number text is silently saved as "inherit"; the server accepts a null `target` value; AR mixes "DA" and "دج"; the results table at 390 px hides Medium/Worst with no cue and cannot be reached by keyboard; the final-price hint contradicts its placeholder.
Screenshots: docs/design/audit/PRICE-2/. A file named `settings-390-?.png` was renamed to `settings-390-unlabeled.png`.

## Findings (ranked)

### Medium
1. **A mistyped number becomes "empty / inherit" while the field still shows the text** (qa)
   - Where: `src/components/fields/number-field.tsx:5-9`, `src/app/app/products/[id]/pricing/pricing-fields.tsx:96`, `pricing-calculator.tsx:151,194`.
   - Failure: `parseNumberInput("250.5.")` returns `null`, and these fields read `null` as "inherit". Say an `officialRate` override is 250 and the owner types "250.5.". The field shows that text, the Overridden chip disappears, and Save deletes the stored override. Final price and ad costs are saved as null the same way. This is the screen ≠ form-value bug from round-1 #1 again.
   - The same happens in `percent-field.tsx:7`: `NaN || 0` turns "5.5.5" into 0. Blur then shows 0, so there the screen and the value at least match.
   - Fix: return a separate "invalid" result (not `null`), show an inline range error, and disable Save.
2. **The server accepts a product override `target` with `value: null`** (qa)
   - Where: `src/lib/pricing-form.ts:304-309`. Both union branches have `.nullable()`.
   - Exploit: an admin posts `overrides: {target: {mode: "markup", value: null}}` straight to `saveProductPricing`. Every price for that product then shows "—". The UI blocks this input, and `savePricingDefaults` already refuses it.
   - Fix: drop `.nullable()` on the target value in the overrides schema, and add a test.
3. **AR currency labels mix scripts** (ui)
   - Where: `src/app/app/products/[id]/pricing/pricing-results.tsx` and the stock-cost and target-profit lines in `pricing-calculator.tsx`.
   - Failure: in AR, the input units say "دج", but the results table, "Stock cost", "… DA per piece" and "Target profit" say "DA". See `product-ar-dark-1280.png`.
   - Fix: use one localized DZD label from `format.ts` or the messages everywhere.
4. **The results table at 390 px shows only the Best column** (ui)
   - Where: `pricing-results.tsx:79`.
   - Failure: Medium and Worst are cut off with no scroll cue. The `overflow-x-auto` container has no `tabIndex`, role or label, so keyboard users cannot scroll it. On screen the row labels did not stay pinned while scrolling, even though the code has `sticky start-0` (`:84`, `:112`). See `product-en-light-390.png` and `product-en-light-390-overrides.png`.
   - Fix: make the container `tabIndex={0}` with `role="region"` and an `aria-label`. Check that sticky works inside `card-surface` (it needs an opaque background and no `overflow` on an ancestor in between). Add an edge-fade scroll cue, or stack the three scenarios below about 480 px.
5. **The final-price hint contradicts its placeholder** (ui)
   - Where: `pricing-calculator.tsx:~186-197`.
   - Failure: the placeholder shows `sale_price` (7800). The hint says that leaving it empty uses the medium recommended price, and the table does use 10 100. The owner cannot tell which one applies.
   - Fix: show the medium recommended price as the placeholder, or reword the hint to say "current store price 7800; empty = recommended 10 100".

### Low
6. **Sub-cent amounts pass the page check, then fail on the server** (qa). Where: `pricing-calculator.tsx:48,51`. The `adOk`/`priceOk` checks skip the cents check, so 2.255 enables Save and then gets only the generic error toast. Validate cents on the page and show the error at the field.
7. **Quantity marks the form dirty, though it is never saved** (qa). Where: `pricing-calculator.tsx:84-85`. Changing only quantity enables Save, which writes a no-op row and an audit row. An invalid quantity also blocks saving the overrides. Leave quantity out of the dirty and `valid` checks for Save.
8. **Invalid quantity shows a contradictory summary** (ui): "5 720 DA, 5 720 per piece × 0 pieces". Show "—" instead.
9. **Stale target line** (ui): "Target profit / piece: 1 500 DA" stays visible while markup mode is selected and invalid.
10. **Range errors are generic** (ui): "Value out of range." should state the range, for example "below 100%".
11. **Platform fee has no sanity warning** (ui): 60% saves silently. Round-1 #8 (null break-even shown as "Missing input") was confirmed on screen only for k≥1.
12. **Money inputs and "Default: 10000" placeholders lack thousands separators** (ui), unlike the rest of the screen.
13. **Settings layout** (ui): "Profit target" appears twice (group heading and field label); the 1280 px grid has empty cells; group headings are tiny and low contrast. The share label says "This product's share", which is wrong for a workspace default.
14. **Accessibility leftovers**: from round-1 #13, the Overridden chip and the unsaved cue are not announced (qa). Focus is lost when the per-field reset button disappears (ui, not confirmed); move focus to the field. Save in its disabled/pending state has low contrast in both themes (ui).
15. **"5.500" saves as 5.5 DA** (qa). Consider a warning when the final price is below the cost per piece.
16. **Screenshot coverage is still incomplete** (round-1 #6). Done: Settings 390 AR-dark and EN-light, Settings 1280 AR-light, product 390 EN-light, product 1280 AR-dark. Missing: EN-dark on both screens, AR-light on the product tab, and a keyboard-only pass. The builder's own PROGRESS screenshots are only at 500 px or wider.

## Missing tests
- `parseNumberInput` returns "invalid" (not null) for "1.2.3", and NumberField/PercentField show an error for it (#1).
- `pricingOverridesSchema` rejects `target.value: null` (#2).
- Audit rows for `product_pricing` INSERT/UPDATE/DELETE (only the `settings` DELETE is covered today).
- `rls.test.ts`: an UPDATE that moves `product_id` to another workspace's product is refused (the probe passes, but there is no test).
- A calculator component test: editing quantity recomputes the stock cost, invalid input keeps the last valid table, and clearing the final price saves null.
- A live (non-mocked) `saveProductPricing` test with a real ws2 product id, so the `.eq("workspace_id")` path is exercised.
- `PricingCell` "—" and "Not possible" in the AR locale; the AR currency label in the results table.
