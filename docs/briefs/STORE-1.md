risk: high · surface: none · lane: store
Spec: docs/specs/STORE.md (Model, acceptance). Decisions: D20, D30, D34, D35, D25-D31 (stock), D46 (KPI untouched).

## Goal
Replace the `products.variants` jsonb and free-text `orders.variant` with options, values and `product_variants` rows, with stock per variant, without changing any D34 stock behaviour.

## Definition of done
- Tables `product_options`, `product_option_values`, `product_variants` exist with workspace_id, RLS (admin write; agents read, no cost fields), `set_updated_at`, `audit_row()` on options/variants, no anon grants.
- Every existing `products.variants` entry becomes one option "Variant" + value + variant row; no data lost; migration is re-runnable-safe.
- `orders.variant_id` (nullable FK) exists; `orders.variant` text is kept as a label snapshot.
- `stock_movements.variant_id` (nullable); `product_variants.stock` changes only via a movement (guard like products_stock_guard); `products.stock` stays the sum, so `product_stock_stages` and `product_stock_v` are unchanged.
- Order stock sync (reconcile/release/delete) moves the variant's movement when `variant_id` is set; add-only (D35) and workspace guard (D30) still hold.
- Back office: product form edits options and variants (replaces the textarea); order form picks a variant; `types` regenerated; `docs/DB.md` updated.

## Real code found
- `00003`: `products.variants jsonb [{label,sku}]`, `stock` maintained by `apply_stock_movement`. `00004`: `orders.variant text`.
- `00028`: `stock_reconcile_order`, `order_stock_effects`, `order_stock_release`, `order_stock_after_delete`, `products_stock_guard`, view `product_stock_stages`. `swap_order` copies `a.variant` (00028, 00030, 00032: latest is 00032 -> must also copy variant_id).
- Code: `src/app/app/products/{actions.ts parseVariants,product-form.tsx}`, `orders/{actions.ts:341-391,order-form.tsx,new/page.tsx}`, `stock/stock-controls.tsx`.
- Latest migration is 00040: new file is `00041_product_variants.sql`.

## Files and changes
1. `supabase/migrations/00041_product_variants.sql`: tables (checklist from AGENTS.md); unique (product_id, name) for options, unique (option_id,label) for values; variant row = `option_value_ids uuid[]`, sku, stock int default 0, price_override, compare_at_override (nullable numeric, UI later in STORE-3), is_active; unique (product_id, option_value_ids). Same-workspace guard trigger (D30 style): variant.product and order.variant must belong to the order's product and workspace.
2. Same file, data migration from jsonb (idempotent: skip products that already have variants). Do NOT drop `products.variants` yet; mark deprecated, drop in a later migration after STORE-3.
3. Same file: `variant_id` on `stock_movements` and `orders`; extend `apply_stock_movement` to update the variant stock; extend guard; extend `stock_reconcile_order` to take the order's variant_id (per-variant `v_current`), `swap_order` copies variant_id. Replace views only if needed, keep `security_invoker`.
4. `src/lib/supabase/database.types.ts`: regenerate (never hand-edit).
5. `src/lib/variants.ts` (new): zod schemas, label builder from values. `products/actions.ts`: save options/variants (admin re-check). `orders/actions.ts`: accept `variant_id`, write label snapshot.
6. UI: `product-form.tsx` options editor (reuse Field/components/fields, i18n en+ar, logical CSS); `order-form.tsx` select variant. `docs/DB.md`.

## Steps (each committed with step.sh)
1 migration tables+RLS+grants. 2 data migration. 3 stock columns, trigger and reconcile changes. 4 regen types. 5 data layer and actions. 6 product form and order form. 7 tests, DB.md, gate.

## Acceptance tests (src/lib/rls.test.ts live suite plus unit)
- agent session cannot insert/update/delete options or variants; can read them; cannot read costs.
- cross-workspace: variant of another workspace refused on order insert (D30).
- migration maps jsonb `[{label:"M / red",sku}]` to one variant with the same label and sku; second run adds nothing.
- stock movement with variant_id changes variant stock and product stock equally; direct UPDATE of variant stock refused.
- order shipped/returned/deleted/swap moves the same variant (D34 table replayed per variant); product-only orders unchanged.
- stock log still add-only; `product_stock_stages` numbers identical before and after.
- anon has no grant on the three tables.

## Edge cases and open points
- Existing orders have only a text label: leave `variant_id` null (no guessing); reconcile treats null as product-level. Product with variants but order without variant_id: movement is product-level; document it.
- Per-variant stock vs products.stock: variant sum may differ from products.stock for legacy product-level stock; assumption: opening balance stays product-level, shown as "unassigned" until counted. Confirm: no new DECISIONS row needed unless owner wants forced sum equality.
- Pricing modes, offers, `product_pricing_mode` belong to STORE-3, not here.
- Needs live local Supabase for D24; gate must not report RLS skipped.
- No new DECISIONS row required.
