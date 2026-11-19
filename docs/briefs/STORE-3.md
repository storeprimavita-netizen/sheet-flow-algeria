# STORE-3 brief — pricing modes, offers, form-fields editor, public form rendering
risk: high · surface: ui · lane: store

Goal: an admin sets how a product is priced (one price / per value / per size), adds quantity offers and order bumps, edits the order-form fields, and `/s/<store>/<slug>` shows the price, offers and a working-looking form from the server-only DTO; submitting is STORE-4.

## Definition of done
- Migration 00051 adds the columns/tables below with RLS, strict grants, types regenerated, DB.md rows, RLS tests (D24 live suite run).
- One pure module computes unit price, line total, offer saving and compare-at saving; STORE-4 reuses it (no second formula, D58 rule). No NaN, integers/DZD, never below 0.
- Public DTO carries only: price per size, compare price, offers (label, qty, total, saving, free-delivery flag), bump (product name, price), form fields. No cost, no sku, no stock count.
- Page renders and orders-nothing form works with native validation (`required`, `inputmode`, `autocomplete`, `<dialog>`-free). Submit stays inert until STORE-4 (honest disabled state + reason is NOT used: button posts to the `#order` slot only after STORE-4; here form is rendered, validated client-side, no network call).
- Cache invalidation: every new mutation calls `updateTag('store-public')`. Gate green; EN/AR key parity.

## Drift found (real code)
- Latest migration is 00050 -> `00051_store_offers_forms.sql`. Spec says variants have `price_override`/`compare_at_override` and values have prices: NONE exist (`product_variants` = id, sku, is_active, stock). `products` has `sale_price` only, no compare price. `wilaya_fees` exists (fees page = P1-7, todo): the form shows a wilaya list but NO delivery price until STORE-4/P1-7.
- `loadVariants` (`src/lib/store/data.ts`) returns `{label, inStock}` only: extend, keep the D58 stock rule untouched; `assembleProductPage` and `store-public` DTO key-set snapshot test must be updated deliberately.
- Product edit UI: `src/app/(app)/app/products/[id]/product-tabs.tsx` (STORE-1 sizes editor, PRICE-2 Pricing tab live there); add a "Selling" tab, do not touch the pricing calculator.

## Migration 00051 (checklist)
- `products`: `pricing_mode` text check `uniform|per_value|per_variant` default `uniform`; `compare_at_price numeric(12,2)` null, check >= sale_price when both set.
- `product_option_values.price_delta numeric(12,2) not null default 0` (per_value mode); `product_variants.price_override numeric(12,2)`, `compare_at_override numeric(12,2)` null, checks >= 0.
- `product_offers`: id, workspace_id, product_id (composite FK to products), kind `quantity|bump`, label, qty int >= 2 (quantity), total_price numeric, bump_product_id null (composite FK, same workspace, bump only), bump_price, free_delivery bool, is_default bool (one default per product, partial unique), position, active_from/active_to null, is_active; CHECKs by kind.
- `product_forms`: product_id PK/unique, workspace_id, `fields` jsonb (zod-validated in app + size CHECK `pg_column_size < 16k`), delivery_methods jsonb, updated_at.
- RLS: read admin+agent on offers/forms (agent sees offer totals, never costs), write admin; UPDATE USING+WITH CHECK; workspace_id immutable; `set_updated_at`; `audit_row()` on both; `revoke all from anon`; revoke truncate/trigger/references from authenticated; trigger rejects bump product from another workspace.

## Files and steps (each: scripts/step.sh)
1. Migration + types + DB.md + `src/lib/store/offers.rls.test.ts` (anon no grant, agent no write, cross-workspace id rejected, bad kind/qty rejected).
2. `src/lib/store/offer-price.ts` (+ `.test.ts`): pure `resolveUnitPrice(mode, product, valueDeltas, variant)`, `applyOffer`, `quantityOfferSaving`; tests: uniform, per_value additive, per_variant override, compare lower than price ignored, offer total vs qty*unit, rounding 0 decimals, huge qty guarded.
3. `src/lib/store/form-fields.ts` (+ test): zod `.strict()`; fixed core fields (name, phone, wilaya, commune, delivery type) locked-required, optional toggles (note, email), up to 5 custom text/select fields (label <= 60, no HTML); defaults const used when row missing.
4. `src/lib/store/data.ts`: DTO adds `pricing`, `offers`, `form`; explicit columns; only active offers inside window; key-set snapshot updated. Plus `actions.ts` per route (admin re-check, zod, `updateTag`).
5. App: Selling tab (pricing-mode switch with "same price for all" tick + grid, offers editor with computed saving, form-fields editor with live preview using the SAME public form component). Components from `components/fields/*`; four states; both themes, AR+EN.
6. Public: `src/components/store/order-form.tsx` (+ offer picker radio group, size picker, qty): phone `inputmode=tel autocomplete=tel`, name `autocomplete=name`, 44px targets, price block with compare + "وفّري X%", sticky CTA on mobile, no emoji; works without JS beyond selection state.
7. i18n (`store.*`, `admin.selling.*` en+ar), screenshots, PROGRESS.

## Acceptance tests (names)
`uniform price all sizes` · `per_value adds delta` · `per_variant override wins` · `offer total beats qty*unit` · `compare below price hidden` · `inactive/expired offer not in DTO` · `DTO key-set snapshot (offers, form, pricing)` · `no cost/sku/stock in DTO` · `agent cannot write offers/forms` · `anon no grant offers/forms` · `bump product from other workspace rejected` · `one default offer per product` · `form fields schema rejects html/unknown keys` · `price change shows on page next request`.
Screens (390 + 1280, light+dark, AR+EN): Selling tab (3 modes, empty offers, error), store page with offers + form, long Arabic labels, 0 offers, 1 size, out-of-stock size.

## Edge cases / assumptions
- per_value = additive delta over `sale_price` (spec says "adds/sets"; additive is deterministic with several options). Owner may overturn; no DECISIONS row needed under D40/D20.
- Quantity offer = fixed total for N pieces; delivery added by STORE-4 (D14). Offer "gift" and discount codes are STORE-5, out of scope.
- Form carries a honeypot field name reserved but no logic (STORE-4). Wilaya fee display waits for P1-7.
