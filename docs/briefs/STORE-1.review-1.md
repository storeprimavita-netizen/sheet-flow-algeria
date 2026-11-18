VERDICT: FIX

## Summary
Second brief review after the D54 rewrite, by qa-reviewer (with owasp-security, checked against migrations 00004/00025/00028/00030/00032/00039/00040, the code and the local DB, read-only) and ui-reviewer (no screenshots, because there is no code yet).
Review-0 is covered for #1, #2, #4, #5, #7 and #8, and all 11 missing tests are listed. #3, #6, #9 and two lows are only partly covered.
1 high and 6 medium findings. D54 covers all of them, so no owner decision is needed. Fix the brief and review again.

## Findings

### High
1. **`stock_count_variants` can write another workspace's stock, and the revoke rule makes it uncallable**: docs/briefs/STORE-1.md:22,28.
   - Exploit: `is_admin()` only checks the caller's own workspace. An admin of workspace 2 calls the RPC with a workspace-1 product id. Security definer skips RLS, so the call moves workspace 1's per-size counts.
   - Line 22 also revokes every NEW function from `authenticated`, so the admin's server action could not call it at all.
   - A count where one size already matches inserts `delta = 0`. `stock_movements_delta_check` refuses that line, so the whole count fails.
   - Fix:
     - revoke from public, anon and service_role, then `grant execute ... to authenticated` (the `swap_order` pattern);
     - `set search_path = public, pg_temp`;
     - check `p.workspace_id = current_workspace_id() and is_admin()`;
     - lock the variant rows with `for update`;
     - take absolute counts and compute each difference inside the function;
     - refuse a variant id that belongs to another product;
     - skip zero differences;
     - link the two lines of a pair with a shared id (say which column).

### Medium
2. **Review-0 #6 is only half fixed by the join table**: STORE-1.md:8.
   - Failure: with plain foreign keys, a `product_variant_values` row can link a variant of product A to a value of product B or of another workspace (the STORE-2 label leak). Two variants can have the same set of values, and one variant can carry both S and M of one option.
   - Failure: variants have no unique key, so `on conflict do nothing` cannot make "re-run adds nothing" true.
   - Fix:
     - add `product_id` and `option_id` to the join table;
     - composite foreign keys: `(variant_id, product_id)` to variants, `(value_id, product_id, option_id)` to values, and values `(option_id, product_id)` to options;
     - unique `(variant_id, option_id)`;
     - a trigger that refuses a duplicate set of values;
     - in the migration, insert a variant only for a value that has none yet.
3. **D54.6 (change of variant moves the hold) has no path in the app**: STORE-1.md:31, src/app/app/orders/actions.ts (only `createOrder` and `swapOrder` touch the variant).
   - Failure: changing the size for an exchange is only possible through the database or a direct API patch. A direct patch also leaves the old text label behind.
   - Fix: add an admin-only, zod-checked `changeOrderVariant` action and a picker on `orders/[id]/page.tsx`. Write the `orders.variant` label snapshot from `variant_id` in a trigger, so every path keeps the label right.
4. **Per-variant stock has no home in the navigation**: brief step 5/9, src/app/app/stock/page.tsx:55-95.
   - Failure: the stock hub is one row per product. "Stock page" does not say whether that means the hub, `/app/products/[id]/stock` or a new route, so the admin cannot see which size is below 0, and "count needed" has no row to sit on.
   - Fix:
     - put the variant table (variant, count, inactive) and "Count by size" on `/app/products/[id]/stock`, with the not-assigned figure and "count needed" there too;
     - add a "count needed" pill on the hub row that links to that page;
     - show the same pill on the product list and the product form.
5. **Purchase and correction per variant point to the wrong file**: STORE-1.md:30 (step 4).
   - Failure: `stock/actions.ts` does not exist. Purchases go through `products/[id]/stock/page.tsx`, and `addStockMovement` lives in `products/actions.ts`. As written, the purchase form on the product stock tab gets no variant picker, so review-0 #3 is only partly fixed.
   - Fix: name the real files, and add the variant choice, including "Not assigned to a size", to both the hub controls and the product stock tab form.
6. **Consumers of `orders.variant` are missing from the file list**: brief "Code" and "Files".
   - Failure: `dashboard/page.tsx`, `orders/confirmation/page.tsx`, `orders/delivery/page.tsx`, `lib/webhook.ts` and `orders/actions.ts` read `orders.variant`. The order form today is free text plus a datalist fed by `products.variants` (order-form.tsx:72-75). The brief does not say what happens:
     - when the product changes;
     - when an old order has a label and no `variant_id`;
     - when the chosen variant is later deactivated.
   - Fix: list these files and keep reading the label snapshot everywhere. Reset the picker when the product changes. Show an old order's label read-only, with "Assign size". Show an inactive variant on existing orders, marked inactive, and hide it from the picker for new orders.
7. **The four states and failure messages are not specified for the new UI**: brief step 5. `src/app/app/stock` has no `loading.tsx` or `error.tsx`.
   - Fix: specify each state.
     - Options editor: empty state with "Add option".
     - Count by size: skeleton; error with reason + retry; success that shows what is left in not assigned; hidden when the product has no variants.
     - Order picker: no picker when the product has no variants.
     - User messages for a duplicate value, a refused inactive variant and an RPC failure.

### Low
- A variant-only change is logged as `order_returned` (00030:59-62). Put `variant_id` in the "product or quantity changed" branch so it logs `order_stock_sync`.
- State what `p_product` means once `stock_reconcile_order` loops over every group, and drop the release of the old product first at 00030:102-104.
- Refuse an inactive variant on UPDATE of `variant_id` too, not only on insert. Say what `swap_order` does when the variant has since been deactivated.
- Add `CHECK (variant_id is null or product_id is not null)` on orders and stock_movements. Make `product_id` unchangeable on options, values and variants, so an upsert by id cannot move a row to another product.
- "Not assigned" subtracts every variant, inactive ones included. A view needs `security_invoker`.
- Index `variant_id` on orders and stock_movements. Add en and ar labels for the `stock_count` reason.
- The migration numbering contradicts itself (line 21 says 00041 and 00042, line 36 says 00041 only). Pick one.
- "count needed" needs an entry in `statuses.ts`, a new StatusKind or token. Do not use ad-hoc Chip colors.
- Accessibility:
  - the inputs per size need labels, through `components/fields`, with Enter to submit;
  - the options editor needs named add, remove and reorder buttons;
  - "remove" becomes deactivate, with a confirm and a way to reactivate;
  - the picker is a Radix Select or Combobox;
  - the pill shows an icon and text, not color alone.
- i18n:
  - list the new en and ar keys, with Arabic plurals for counts;
  - isolate Latin variant labels in AR (`dir="auto"` or `<bdi>`);
  - keep a stable value order in the label builder.
- Screenshot pass: dark and light, EN and AR, 1280 and 390 px, with the table stacked on mobile. Add the inactive-variant, empty, error and old-order label views.
- The agent view of the order form and stock pages shows no cost (`price_override` excepted).

## Review-0 coverage
- Covered: #1, #2, #4, #5, #7, #8, and the low about auditing options and values only. All 11 missing tests from review-0 are in the acceptance list.
- Partly covered:
  - #3: purchase on the product stock tab is missing (finding 5);
  - #6: finding 2;
  - #9: right in the database, but no app path (finding 3);
  - low "skip duplicates": variants have no unique key (finding 2);
  - low "inactive variant": refused on insert only.

## D54 coverage
- Points 1, 2, 3 and 5 are met.
- Point 4 is deferred to STORE-4, as D54 allows.
- Point 6 is met in the database but has no app path (finding 3).

## Missing tests
- A count on another workspace's product is refused, and so is a count by an agent or by anon. An admin's count succeeds.
- A count where one size already matches. A count that includes a variant of another product.
- A join row to a value of another product or workspace is refused. A duplicate set of values is refused, and so are two values of one option.
- Re-running the data migration adds nothing.
- A variant-only change logs `order_stock_sync`.
- A purchase on a size from the product stock tab.
- `changeOrderVariant` moves the hold and updates the label. A direct patch updates the label too.
- Updating an order to an inactive variant is refused.
- The picker resets when the product changes. An inactive variant is hidden from the picker but shown on existing orders.
- The i18n parity gate and the hardcoded-color lint pass on the new files. A keyboard-only walk through the options editor.
