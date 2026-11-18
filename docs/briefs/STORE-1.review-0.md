VERDICT: ESCALATE

## Summary
Brief review (review-0, qa-reviewer, checked against migrations 00028/00030/00039/00040 and the local DB, read-only).
The approach is sound, but the stock design misses variant changes, per-variant release on delete, and grants on recreated functions.
Two points need the owner: opening stock per variant (today all units sit on the product, so every variant would start at 0) and exchange per variant (D29 defers it to STORE-1).
The brief's "no new DECISIONS row" is wrong. Rewrite the brief after the owner decides.

## Findings

### High
1. **Changing the variant on an order moves no stock**: brief §3, `supabase/migrations/00030_stock_followup.sql:79-87,131-134`.
   - Failure: the `orders_stock_effects` trigger column list and its early return ignore `variant_id`. An order on road as M, patched to L, leaves M held, never moves L, and logs nothing.
   - Fix: add `variant_id` to the trigger columns and to the early-return check. Make `stock_reconcile_order` loop over every (product_id, variant_id) group of the order's movements: the current group goes to target, every other group goes to 0. This also covers a product change and an old order that later gets a variant.
2. **Order delete releases stock to the wrong place**: `00030_stock_followup.sql:143-151` (`order_stock_release`).
   - Failure: it groups by `product_id` only and writes the release line with no variant. Deleting an order reserved as M returns the piece to the product but leaves M short for good.
   - Fix: group by `(product_id, variant_id)` and copy `variant_id` into the release line.
3. **"products.stock stays the sum" is false on day one** (owner decision): brief DoD, `src/app/app/products/actions.ts:194-210`, `src/app/app/stock/stock-controls.tsx`.
   - Failure: locally, all 717 units sit on the 5 products that have variants. After the migration every variant has 0, so the first shipped order puts its variant at -1, and STORE-4's out-of-stock check would refuse every order. There is also no way to add stock to a variant: `addStockMovement` and the stock controls take no variant.
   - Fix: add a variant picker to purchase and correction. The owner must choose:
     - how opening stock is set: a count per variant, an "unassigned" bucket, or a forced sum;
     - whether variant stock may go negative (a `stock >= 0` CHECK would stop orders from shipping).
4. **Recreated stock functions become callable by agents and anon**: brief §3.
   - Failure: the local default privileges grant EXECUTE on new functions to anon and authenticated. If `stock_reconcile_order` gets a new signature (drop + create), it comes back callable over RPC. It runs with owner rights and writes stock lines for any order in any workspace.
   - Fix: in 00041, `revoke all on function ... from public, anon, authenticated, service_role` for every new or recreated function, and `revoke all on <3 tables> from anon` (the 00040 pattern).

### Medium
5. **Workspace and product guards are incomplete**: brief §1.
   - Failure: the guard is trigger-only. Service-role paths (webhooks, STORE-4) and a product change that leaves an old `variant_id` behind can pair variant X of product A with product B.
   - Fix: use composite foreign keys (`products_id_workspace_uniq` already exists from 00039):
     - options, values and variants: `(product_id, workspace_id) → products`;
     - orders and stock_movements: `(variant_id, product_id) → product_variants(id, product_id)`.
6. **`option_value_ids uuid[]` has no integrity**: brief §1.
   - Failure: array order defeats the unique key ({a,b} and {b,a} are both accepted). Elements can point to deleted values or to another workspace's values, so the STORE-2 service-role data layer would show another tenant's labels.
   - Fix: a join table `product_variant_values` with foreign keys, or a CHECK that the array is sorted plus a trigger that checks each element.
7. **Variant stock can be set without a movement**: brief §3.
   - Failure: the guard covers UPDATE only, so an admin can INSERT a variant with `stock = 500`.
   - Fix: require `stock = 0` on insert, in the guard or a CHECK on insert.
8. **Variant delete fails or breaks history**: brief §5, `00028_stock_three_stages.sql:262-281`.
   - Failure: saving variants as delete + reinsert is refused by `stock_log_add_only` or the order foreign key.
   - Fix: upsert by id and set `is_active = false` instead of deleting. Use NO ACTION (not RESTRICT) on `stock_movements.variant_id` so deleting a whole product still cascades.
9. **Exchange per variant is not addressed** (owner decision): D29 defers releasing stock during an exchange to STORE-1. The brief says only "no D34 change".
   - Fix: the owner decides, or a DECISIONS row explicitly defers it.

### Low
- The data migration should skip blank or non-object entries and duplicate labels (`on conflict do nothing`). Check production for duplicate SKUs before adding any unique SKU key.
- `audit_row()` on `product_variants` writes an audit row on every stock movement. Exclude `stock` or audit options and values only.
- Nothing stops a new order on an inactive variant.

### Checked and correct
- Agents reading `price_override` matches the existing `sale_price` rule.
- `guard_order_fields` already stops confirmation agents from patching `variant_id`.
- KPI functions and the stock views stay product-level (D46 unaffected).
- `swap_order` keeps its signature, so its grants survive a replace.

## Missing tests
- Variant M→L in each stage (reserved, on road, delivered, returned).
- An old order with no variant later gets one.
- A product change with a stale `variant_id` is refused.
- Order delete releases per variant.
- A variant/product mismatch is refused on order insert and on movement insert, through both the service role and an admin.
- Variant INSERT with stock ≠ 0 is refused.
- Deleting a variant that has movements or orders is refused.
- An agent PATCH of `orders.variant_id` is refused.
- No new or recreated function is executable by anon or authenticated.
- Swap keeps `variant_id` and moves that variant.
- Migration of blank and duplicate jsonb entries.
