# VAR-1-B — Options link and storefront colour picker

risk: low · surface: ui · lane: store

Goal: reach the linked product’s Options from Store and select a real product colour in the shared order form.

## Done

- From Store → Pages → a linked product page, Forms & offers opens that product’s Selling tab. Its Edit options link jumps to the product’s Options editor. The Store routes and Selling tab keep their existing admin guards.
- The shared order form shows labelled colour radios with a validated photo, validated colour, or a text label alone. Colours without an in-stock sellable combination are visible and disabled. A chosen colour narrows the available combinations for that piece. Changing colour clears the old combination and its price when it no longer applies.
- A colour-only product selects its variant directly. Products with size or additional options still select the exact existing variant, preserve the default when the sole variant is in stock, and display the existing per-value or per-variant amounts. An invalidated selection needs a new choice before pricing or validation can succeed. The size-only flow stays available.
- Quantity offers can take pieces of different colours and sizes. The existing shortcut copies the full combination to each piece, and its label reflects that for colour products. Variant field names, exact variant IDs, and the existing offer calculation remain the form contract (D61).
- The shared order form currently runs in the admin preview. Public product pages continue showing their read-only chips and orders-opening state until STORE-4. VAR-1-F covers size-set deletion and disabled option hints.

## Files and steps

1. Wire app navigation.
   - `src/app/(app)/app/store/pages/[id]/page.tsx`: add a translated Forms & offers ButtonLink to `/app/catalog/products/<productId>/selling` when the current page has a valid linked product. Store has no standalone Forms & offers route on v3.
   - `src/app/(app)/app/catalog/products/[id]/selling/page.tsx`: add translated Edit options to `/app/catalog/products/<id>#product-options`. Give the section in `catalog/products/_components/variants-editor.tsx` that stable anchor and logical scroll margin for the app header.
2. Wire colour selection in the shared form.
   - `src/lib/store/data.ts`: existing variant-value joins identify the one typed colour option enforced by migration 00068. Add optional colour picker metadata only on a priced active variant with a colour match: presentation key, label, sanitized swatch, and label for the remaining values (null for colour-only). Key by value identity internally and emit an ordered presentation key. Keep the existing full variant label and the read-only option DTO. Reuse one swatch validator for both representations. Publish only the existing DTO fields and the listed presentation fields.
   - `src/components/store/order-form.tsx` and `order-form-strings.ts`: use optional metadata on the existing variants prop. Group by key, filter candidates per piece, use only in-stock combinations for selection, and keep the flat radios for products without complete colour metadata. Use native radio focus and fieldsets, visible labels and sold-out names. Focus an enabled missing choice on validation and clear its stale error once resolved. Scope radio names to a piece and preserve `variant_<i>` when a complete combination is selected. The existing preview caller already passes `dto.variants`.
   - `src/components/store/product-view.tsx`, `store.css`: reuse the safe swatch markup and existing store tokens, 44px targets, wrapping and focus styles. Render photo swatches as lazy decorative images and colour values through the existing validated CSS variable. The text label remains readable when an image fails.
   - `src/messages/en.json`, `src/messages/ar.json`: translated navigation, colour, generic combined-option labels/errors where needed, and the mixed-piece shortcut. Store UI remains Arabic and follows device theme (D61), app UI follows its own locale and theme (D76, D93).
3. Run the full gate with live DAL coverage and capture the UI. No migration or new dependency.

## Acceptance checks

- `src/lib/store/data.test.ts`: extend “colour option: swatch in the DTO…” to assert membership by variant, safe colour and photo, and remaining label. Cover an inactive or unpriced combination with existing fixtures. Keep the size-only DTO key-set checks and no internal fields checks.
- `src/components/store/order-form.test.tsx`: cover “colour radios render text, colour and photo swatches with accessible names and stock state,” retain “several sizes” and “per_value shows +delta pills.” If selection logic moves to a pure helper, pin “colour change cannot carry a variant from the previous colour” and “mixed-piece offers keep independent combinations.” Verify those interactions in browser either way.
- Browse the linked page editor → Selling → Options, including the no-linked-product editor case. Capture those screens and Settings → Options (size sets/backfill if shown) in EN/AR, dark/light, 390/1280. Capture the preview form and public product in AR in both device themes at 390/1280, including no selection, a colour with both available and unavailable combinations, a photo swatch, a colour with no stock, mixed pieces and keyboard navigation. Use local fixtures and capture under `docs/design/audit/VAR-1-B/`. Record any missing evidence in PROGRESS.

References: STORE spec, D61, D76, D93, VAR-1 Screens, VAR-1 review 4. The plan’s “unmerged” note predates STORE-3 shipping.
