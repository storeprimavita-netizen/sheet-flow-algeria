# STORE-3 brief (rev 1, after review-0 + D60) — pricing modes, offers, form-fields editor, public form
risk: high · surface: ui · lane: store

Goal: an admin sets how a product is priced, adds quantity offers and one bump, edits the order-form fields; the store page shows price, offers and the form fields, with NO live submit (STORE-4).

## Definition of done
- Migration 00051 + types + DB.md + RLS tests (D24 live suite).
- One pure `offer-price.ts` owns unit price, offer charge, savings; STORE-4 reuses it. Integer DZD, never NaN; unit price <= 0 => size not sellable (refused, not clamped).
- Public DTO: pricing, compare price, variant ids + per-size price, offers (id, label, qty, total, saving), bump (id, name, price), form fields. No cost, sku, stock count, NO free delivery (D60).
- Public page: NO enabled submit (review #1/#2). Until STORE-4 the `#order` block shows an honest "orders open soon" state, no button. The same presentational form renders only in the admin preview (inert, `method="post"`, `action` = future STORE-4 endpoint, `preventDefault` after hydration).
- Every new mutation calls `updateTag('store-public')`. Gate green, EN/AR parity.

## Drift (real code)
- Latest migration 00050 -> `00051_store_offers_forms.sql`. `product_variants` has no price columns; `products` has `sale_price` only. `wilaya_fees` exists but fees UI = P1-7: no delivery price shown.
- `loadVariants` (`src/lib/store/data.ts:~125`) returns `{label,inStock}`: extend with id + price; move the D58 stock rule into a shared pure function (same behaviour).
- Tabs are routes: `src/app/(app)/app/products/[id]/layout.tsx:31` list. Add `[id]/selling/page.tsx` + entry + `admin.*` key. Store page: `src/app/(store)/s/[store]/[slug]/page.tsx` (JSON-LD price = lowest size price).
- `save_variant_config` (00048) upserts set only listed columns: new price columns survive re-save (test it).
- `products/actions.ts:87` throws raw `error.message` on update: so NO compare>=sale CHECK.

## Migration 00051 (AGENTS.md new-table checklist)
- `products`: `pricing_mode` check uniform|per_value|per_variant default uniform; `compare_at_price` numeric(12,2) null (no CHECK vs sale_price; hidden in code when <= price).
- `product_option_values.price_delta` int-valued (check `= trunc`), default 0, check abs bounded. `product_variants.price_override`, `compare_at_override` null, >= 0, integer. Column-scoped audit for these (variants has no audit trigger).
- `product_offers`: id, workspace_id, product_id, kind quantity|bump, label (len <= 60), qty (quantity: 2..50), total_price > 0 (quantity), bump_product_id + bump_price >= 0 (bump only), is_default, position, active_from < active_to null, is_active. NO free_delivery (D60). Partial unique default per (product) where kind='quantity'. Composite FK to products; bump FK `ON DELETE SET NULL (bump_product_id)`; trigger rejects self-bump, other-workspace, inactive/unpriced or sized bump product (keep FK or trigger for workspace, not both).
- `product_forms`: product_id pk, workspace_id, `fields` jsonb (size CHECK < 16k), `delivery_methods text[]` check non-empty subset of {home,stopdesk}, updated_at.
- RLS: read admin+agent offers/forms; write admin only; UPDATE USING+WITH CHECK; reuse `store_workspace_immutable()` / `product_id_immutable()`; `set_updated_at`; `audit_row()`; revoke anon, revoke truncate/trigger/references from authenticated.

## Steps (each `scripts/step.sh`)
1. Migration, types, DB.md, `offers.rls.test.ts`.
2. `offer-price.ts` + test. Rules: saving per selected size; charge `min(total, qty*unit)`, hide offers that save nothing; mixed sizes = per-piece size rows with "same size" toggle (rule documented for STORE-4).
3. `form-fields.ts` + test: zod `.strict()`, core fields (name, phone, wilaya, commune, delivery) forced required, optional note/email, <= 5 custom text/select fields (label <= 60, no HTML, no emoji), labels in store language; DAL `safeParse` at read, fall back to defaults.
4. `data.ts` DTO (active offers inside window, Africa/Algiers; invalid bumps excluded) + selling `actions.ts` (admin re-check, zod, `updateTag`); update key-set snapshot once.
5. Selling tab: admin only + route guard, "View on store" link, mode switch (disabled with reason when no sizes; confirm before discarding deltas/overrides), offers editor (Up/Down reorder with names, `DeleteButton`, aria-labels), form editor. Four states, save error with reason + retry, success feedback. Tabular LTR prices.
6. `src/components/store/order-form.tsx`: props-only, no `server-only`, strings passed in; preview in scoped store-theme wrapper with `dir`, app-styled "Preview, not live" label + 390 toggle. Fields: `inputmode`, `autocomplete`, native wilaya `<select>`, phone 10 digits 05/06/07 LTR, inline errors, summary (product total + saving, no delivery line), "starting from X" (per_variant), "+delta" pills (per_value), no preselect when several choices, 44px targets, safe-area sticky CTA only in preview.
7. i18n `store.*` + `admin.selling.*`, screenshots, PROGRESS.

## Acceptance tests
`uniform price all sizes` · `per_value adds delta` · `per_variant override wins` · `negative delta makes size unsellable` · `offer capped at qty*unit` · `compare below price hidden (all modes)` · `product save with sale above compare ok` · `inactive/expired offer not in DTO` · `DTO key-set snapshot` · `no cost/sku/stock/free_delivery in DTO` · `agent cannot write offers/forms/price columns` · `anon no grant` · `bump rules (self, other ws, sized, deleted)` · `one default offer` · `invalid fields jsonb renders defaults` · `form method is post` · `save_variant_config keeps prices` · `price change shows next request`.
Screens (390 + 1280, light+dark, AR+EN): Selling tab (3 modes, empty, error), store page (offers, "orders open soon", 0 offers, 1 size, out-of-stock), admin preview with validation error.

## Edge cases / assumptions
- per_value = additive delta over `sale_price` (owner may overturn).
- Quantity offer = fixed total for N pieces; delivery added by STORE-4 (D14, D60). Gift, codes = STORE-5. Free delivery waits on Q-14.
- No new DECISIONS row needed; owner input not required.
