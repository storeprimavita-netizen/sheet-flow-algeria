VERDICT: FIX

## Summary
Reviewers: qa-reviewer (risk high, security) and ui-reviewer (surface ui, ran the app with the browser MCP). Diff `git diff v3...v3-STORE-1`. First review of the build (review-0 and review-1 were of the brief).
No high findings. Full `scripts/gate.sh` passed in review: tsc, 467 tests with the live RLS suite (includes `src/lib/variants.rls.test.ts`), i18n parity, color lint, build, protected paths, secret scan. Read-only probes in rolled-back transactions: anon has no EXECUTE on the new functions and no grants on the new tables or the view; a product whose variants have movements deletes correctly; an order on a variant with no values keeps the client's text.
Holding up: the workspace and admin checks in the count function, the composite FKs, the anon revokes, the agent allow-list on `variant_id` (00025 default-deny), and the hold moving with the variant. Colors come from tokens in both themes; no cost data in the views checked.
There are 6 medium findings (2 data/stock, 4 UI) and 13 low. No finding needs an owner decision.

## Findings

### 1. Medium: the stock hub "Adjust" dialog has no size choice
- **Where:** `src/app/app/stock/stock-controls.tsx:33-46`.
- **Failure:** D54.2 and review-1 #5 require purchases and corrections on a product with sizes to ask for a size, with "Not assigned" as an explicit choice. The hub sends no `variant_id`, so every adjustment silently lands in "Not assigned".
- **Fix:** add the same `EnumSelect` used on `products/[id]/stock/page.tsx:132-142`.

### 2. Medium: `saveVariantConfig` is several separate calls, not one transaction
- **Where:** `src/app/app/products/actions.ts` (`saveVariantConfig`, ~l.222-275).
- **Failure A:** with a stale tab or two admins, the variant upsert succeeds and the join insert is then refused by the deferred duplicate-set trigger. That leaves an active variant with no values (the DB allows it — checked). It shows with a blank label in the order picker and the count form, and a saved variant cannot be deleted from the UI.
- **Failure B:** "no new option once a size exists" is enforced only in the UI (`locked`). A tab opened before the first size was saved can still add an option; existing variants get no join row for it (the `hasValues` filter skips them). On the next load the config fails the `variant_values` check, so that product's editor can never save again.
- **Fix:** move the whole save into one security-invoker plpgsql RPC. Refuse a new option when variants exist. Add a deferred check that every variant has exactly one value per option of its product.

### 3. Medium: sizes change order between screens
- **Where:** `src/lib/catalog/variants-data.ts:34` (orders variants only by `created_at`; nested values on line 27 unordered).
- **Failure:** migrated rows share a timestamp, so the order is unstable. Veste Sarah showed S, M, L in the editor, then L, S, M on the stock page and in the order-form picker after one "Count by size" save (`stock-count-submitted-dark-en-1280.png`, `order-new-picker-open-dark-en-1280.png`).
- **Fix:** sort by option-value `position` through the label builder's stable order; add `.order("position")` to the nested values.

### 4. Medium: deactivating a size uses native `window.confirm`
- **Where:** `variants-editor.tsx:225`.
- **Failure:** unstyled, blocks the page, not the app's dialog pattern.
- **Fix:** use the app's Radix confirm dialog (as `DeleteButton` does) and name the item.

### 5. Medium: value reorder arrows are wrong for a row layout and not mirrored in RTL
- **Where:** `variants-editor.tsx:139-144`.
- **Failure:** ArrowUp/ArrowDown on chips laid out in a row; `rtl:-scale-x-100` on a vertical arrow does nothing (`options-filled-light-ar-1280.png`).
- **Fix:** ChevronLeft/ChevronRight (or ArrowLeft/ArrowRight) swapped in RTL.

### 6. Medium: focus is lost after structural edits
- **Where:** `variants-editor.tsx:233` (remove an unsaved size → focus drops to `<body>`), `:157` ("Add value" leaves focus on the button, not the new input).
- **Fix:** focus the new input after add; after remove, focus the next row's control or the Add button. (Reorder and deactivate/reactivate already keep focus.)

### 7. Low: possible deadlock between a count and an order movement
- **Where:** `00045:24,30` locks product then variant; `00044` `apply_stock_movement` updates variant then product.
- **Failure:** a carrier status sync during a count can abort with 40P01, against D54.3 ("a count never stops a carrier update").
- **Fix:** update `products` first in `apply_stock_movement` (new migration — 00044 is already applied).

### 8. Low: inactive-variant refusal shows raw English Postgres text
- **Where:** `orders/actions.ts:430` → `variant-card.tsx:43`.
- **Fix:** map "this variant is inactive" to an i18n key (EN + AR).

### 9. Low: the label snapshot can still go stale
- **Where:** `00044:36-57` (trigger fires only on `update of variant_id`, returns early when the variant is null).
- **Failure:** a direct admin PATCH of `orders.variant` changes the label while `variant_id` stays; clearing `variant_id` keeps the old label.
- **Fix:** also fire on `variant`, and always rewrite the label when `variant_id` is set.

### 10. Low: an inactive size with non-zero stock cannot be corrected
- **Where:** `products/[id]/stock/page.tsx:115,139` (count form and purchase picker drop inactive sizes).
- **Fix:** show them, marked inactive (the RPC already accepts them).

### 11. Low: the duplicate-set trigger takes no lock
- **Where:** `00042` `product_variant_values_unique_set`.
- **Fix:** `pg_advisory_xact_lock(hashtext(product_id::text))` (new migration).

### 12. Low: two Save buttons on the product screen
- **Failure:** "Save" (product) and "Save options and sizes" do not save each other's edits; saves use inline text rather than the toast.
- **Fix:** unsaved-changes hint per block, or fold into one save.

### 13. Low: `/app/products/new` has no size field any more
- **Fix:** a notice on the create form ("add sizes after the first save") or a hint after creation.

### 14. Low: count-by-size rows show a bare current count
- **Where:** `count-by-size.tsx` ("S 0", "0S" in RTL).
- **Fix:** label it ("Now:") or use the column-header layout of the stock-by-size table.

### 15. Low: accessible names not unique or empty
- **Failure:** every value input is named "Value"; new empty chips get "Remove value " with no name; the deactivate/reactivate icon buttons have no tooltip.
- **Fix:** "Value N of <option>"; tooltips on the icon buttons.

### 16. Low: 390 px touch targets and Arabic label
- **Failure:** chip buttons ≈ 28×32 px; option name row wraps awkwardly (`options-filled-light-ar-390.png`); AR "+ القيمة" reads "the value", not "Add value".

### 17. Low: migrated option is named "Variant" in English for every product, also in Arabic (data/i18n note).

### 18. Low: "Count needed" pill wraps to two lines in the stock hub row (`stock-hub-dark-en-1280.png`).

### 19. Low: order detail Size card sits at the bottom, far from the Size field in the header; "New order" has no breadcrumb.

## Missing tests (vs the brief's acceptance list)
- `changeOrderVariant` action and any size change from an admin session (all size-change tests use the service role).
- `saveVariantConfig`: id from another product or workspace, deactivate and reactivate, duplicate-value message, partial failure (finding 2).
- Size change at the reserved stage (`wait_for_deposit` confirmed), `stop_desk_waiting` and `delayed`.
- A variant with no values or missing an option.
- The hub dialog size choice (finding 1).
- Stable size order across editor, stock page and picker (finding 3).
- Picker reset on product change; inactive size hidden on new orders but shown on existing ones.

## Not checked
- Stock `error.tsx` / `loading.tsx` states (code exists, not triggered); the inactive size marked on an existing order; agent-session views.
- The full dark/light × EN/AR × 390/1280 matrix: the only AR and 390 px captures are light mode. Screenshots: `docs/design/audit/STORE-1/` (14 files).
- `database.types.ts` could not be compared with a fresh regen in review (`supabase gen types --local` printed nothing).
- Local DB note: the UI review saved a count (60 S, 40 M) on Veste Sarah.
