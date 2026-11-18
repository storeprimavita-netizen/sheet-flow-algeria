risk: high · surface: ui,security · lane: store
Spec: docs/specs/STORE.md (Model). Decisions: D20, D30, D34, D35, D46, **D54 (stock per size, locked)**. Rewrite after review-0 (ESCALATE); no new DECISIONS row needed, D54 covers #3 and #9.

## Goal
Replace `products.variants` jsonb and free-text `orders.variant` with options, values and `product_variants`, with per-variant stock that never invents a number and never blocks a sale (D54).

## Definition of done
- Tables `product_options`, `product_option_values`, `product_variants`, `product_variant_values` (join: variant_id, value_id, FKs, unique) with workspace_id, RLS (admin write; agents read, no cost fields), `set_updated_at`, no anon grants (`revoke all ... from anon`, 00040 pattern). `option_value_ids uuid[]` is NOT used (review #6).
- Composite FKs: options/values/variants `(product_id, workspace_id) -> products_id_workspace_uniq`; `variants` unique (id, product_id); `orders` and `stock_movements` `(variant_id, product_id) -> product_variants(id, product_id)` (review #5). Variant uses NO ACTION on delete from movements/orders; variants are deactivated (`is_active=false`), never deleted when referenced (#8).
- Variant INSERT requires `stock = 0`; `stock` changes only through a movement (guard like `products_stock_guard`, #7). No `stock >= 0` CHECK (D54.3).
- `products.stock` stays the total; not assigned = total - sum(variants), computed (view/function), never stored. `product_stock_stages`, `product_stock_v`, KPIs unchanged.
- Migration: each valid `{label,sku}` jsonb entry -> option "Variant" + value + variant (stock 0); skip blank/non-object/duplicate labels (`on conflict do nothing`); re-run adds nothing; `products.variants` kept (drop after STORE-3). Old orders keep text label, `variant_id` null (D54.5).
- Order stock follows the variant, including change of variant (D54.6); old orders stay product-level.
- audit_row() on options/values only (not variant stock).

## Real code found (verified)
- 00030 `order_stock_effects` trigger lists columns `delivery_status, confirmation_status, quantity, product_id, swapped_to_order_id` and the early return ignores variant_id. `stock_reconcile_order` (00030:27) filters movements by product only; `order_stock_release` (00030:136) groups by product only; `apply_stock_movement` (00028:31) updates products only. `swap_order` latest = 00032, copies `a.variant`. Latest migration 00040 -> `00041_product_variants.sql`.
- `guard_order_fields` already blocks confirmation agents from patching variant_id (re-test). Code: `products/{actions.ts parseVariants,product-form.tsx}`, `orders/{actions.ts,order-form.tsx,new/page.tsx}`, `stock/{page.tsx,stock-controls.tsx}`.

## Files and changes
1. `00041_product_variants.sql` (steps 1-3 below). New enum value `stock_count` for transfer lines: ALTER TYPE ADD VALUE cannot be used in the same transaction -> put it in its own file `00041_stock_count_reason.sql`, tables in `00042_product_variants.sql` (renumber; confirm latest at build time).
2. Stock functions, all `create or replace` keeping the existing signatures (grants survive); every NEW function gets `revoke all ... from public, anon, authenticated, service_role`:
   - `apply_stock_movement`: product.stock += delta always; if variant_id, variant.stock += delta (variant must belong to product, workspace). Movement with variant_id enforced by composite FK.
   - `order_stock_effects`: add `variant_id` to trigger columns and early-return check; also reconcile when product OR variant changes.
   - `stock_reconcile_order`: loop over every (product_id, variant_id) group in the order's movements plus the current group; current group -> target, all others -> 0; new lines carry variant_id (#1).
   - `order_stock_release`: group by (product_id, variant_id), copy variant_id (#2).
   - `swap_order`: copy `variant_id`; the replacement holds the same variant.
   - `stock_count_variants(product, jsonb counts)` security definer, admin check inside: per variant, two linked `stock_count` lines (variant +d, product-level variant null -d), one transaction, product total unchanged (D54.2).
   - Refuse a new order on an inactive variant (trigger on insert).
3. `database.types.ts` regenerated, never hand-edited.
4. `src/lib/variants.ts` (new): zod, label builder, `variantStatus()` (count needed when variant < 0 or not-assigned != 0). `products/actions.ts` upsert options/values/variants by id, deactivate removed ones. `orders/actions.ts`: accept `variant_id`, write label snapshot. `stock/actions.ts`: `countBySize`, purchase/correction take optional variant ("Not assigned to a size" explicit).
5. UI: `product-form.tsx` options editor; `order-form.tsx` variant picker; stock page: "Count by size" form, remaining "not assigned" figure, "count needed" pill via `statuses.ts`/StatusPill. i18n en+ar parity, logical CSS, no hardcoded colors, four states.
6. `docs/DB.md` updated.

## Steps (each `step.sh`)
1 enum value. 2 tables+RLS+FKs+grants. 3 data migration. 4 stock columns, apply_stock_movement, reconcile/release/effects/swap. 5 count function. 6 regen types. 7 data layer+actions. 8 product and order forms. 9 stock page. 10 tests, DB.md, gate.

## Acceptance tests (live RLS suite + unit)
Agent cannot write options/variants, can read, no costs · anon no grant · variant/product mismatch refused on order insert and movement insert (service role and admin) · stale variant_id after product change refused · variant INSERT stock!=0 refused · direct stock UPDATE refused · deleting a variant with movements/orders refused, product delete still cascades · variant M->L at reserved/on road/delivered/returned moves the hold; old order later gets a variant · order delete releases per variant · swap keeps variant_id and moves it · exchange keeps quantity out on current variant · count-by-size leaves total unchanged, add-only log intact · variant goes to -1 without refusing a status change · agent PATCH of orders.variant_id refused · no new/recreated function executable by anon/authenticated · migration with blank and duplicate jsonb entries · `product_stock_stages` identical before/after · order on inactive variant refused.

## Screenshots (both themes, EN + AR)
Product form options editor, order form picker, stock page (count by size, count needed).

## Open
Store-check rule (D54.4) belongs to STORE-4. No SKU unique key here. Check no browser MCP before claiming screenshots.
