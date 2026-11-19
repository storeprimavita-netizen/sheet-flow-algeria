VERDICT: FIX

## Summary
Brief review (design, before code) by qa-reviewer and ui-reviewer. The scope is right, but there are 3 highs. The inert public form leaks PII through GET and looks like it takes orders. The live preview mixes the store and app design systems. Mediums cover a CHECK that breaks the existing product save, offer pricing that is undefined per size, missing money CHECKs, form jsonb validated only in the app, bump rules, free_delivery against D14, and Selling tab states and IA. Revise the brief, then build.

## Findings (ranked)

### High
1. **The inert form leaks PII by GET.** Location: DoD "no network call", step 6 "works without JS". A `<form>` with no `method` submits as GET before hydration (slow in-app browsers) or with JS off. That navigates to `/s/x/y?name=…&phone=…`, which puts PII in Vercel logs, history and referers. The admin preview has the same problem. **Fix:** `method="post"`, an `action` that is not the page URL (the future STORE-4 endpoint, 404 until then), and `preventDefault` after hydration. Test: the form method is post, and no PII field can be submitted by GET.
2. **A dead submit button on live product pages.** Location: DoD l.10. An enabled, validating "اطلبي الآن" that sends nothing makes a COD customer believe she ordered. It also contradicts `luxe-modesty-store-theme` order-form.md (submitting and failure states). **Fix:** do not render the `#order` form on public pages until STORE-4 (it shows only as the app preview). Or render an honest "orders open soon" state with no submit. Never show a submit that looks successful but does nothing.
3. **The live preview mixes the two design systems.** Location: step 5 "SAME public form component". Mounting a store component (store.css/theme.css, burgundy on ivory, store intl) inside the app will either inherit app tokens (wrong preview) or leak store tokens into the app (breaks the no-hardcoded-color rule and the dark/light rule). **Fix:**
   - Make `order-form.tsx` props-only and presentational: no `server-only`, strings passed in, no app field components.
   - Mount it in a scoped store-theme wrapper (or an iframe of a draft preview route), with `dir` and locale taken from the store language.
   - Frame it with an app-styled "Preview, not live" label, a 390 px toggle, and an inert state.

### Medium
4. **`compare_at_price >= sale_price` CHECK breaks product save.** Location: `src/app/(app)/app/products/actions.ts:87-88`. Raising `sale_price` above the compare price hits the constraint, and the raw `error.message` is thrown. It also contradicts the test `compare below price hidden`. **Fix:** drop the CHECK and hide a stale compare price in `offer-price.ts`. Or clear/adjust it in that action.
5. **Offer total vs per-size prices is undefined.** Location: step 2, DTO `saving`. A product-level fixed total with per_value/per_variant prices gives one wrong "saving" figure. On a cheap size, "2 for T" can cost more than 2×unit, which overcharges the customer. Mixed sizes inside an offer are also undecided (STORE-4 needs this). **Fix:** decide in `offer-price.ts` now:
   - saving computed per selected size;
   - charge `min(total, qty×unit)`, or hide an offer that saves nothing;
   - a mixed-size rule with per-piece size rows and a "same size" toggle.
6. **Money columns are missing CHECKs.** Location: Migration section. A negative `price_delta` drives the unit price to 0, and "never below 0" then gives a 0 DZD order. `qty` has no upper bound. **Fix:**
   - a unit price ≤ 0 makes the size not sellable (refuse it, do not clamp);
   - `total_price > 0`, `bump_price >= 0`, `qty between 2 and 50`, `active_from < active_to`;
   - integer CHECKs (`x = trunc(x)`) on the new money columns instead of rounding.
7. **`product_forms.fields` is validated only in the app.** A direct admin PostgREST write bypasses zod. **Fix:**
   - the DAL runs `safeParse` at read time, falls back to defaults, and always forces the core fields (name, phone, wilaya, commune, delivery) as required;
   - `delivery_methods` becomes a `text[]` CHECKed to a non-empty subset of `{home,stopdesk}`.
8. **Bump rules are missing.** Nothing excludes a self-bump, an inactive or unpriced bump product, or a bump product with sizes (STORE-4 cannot pick a variant for it). On the composite FK, plain `ON DELETE SET NULL` also nulls `workspace_id`, and NO ACTION makes product delete fail with a raw error. **Fix:**
   - `ON DELETE SET NULL (bump_product_id)` or cascade;
   - the DAL excludes invalid bumps;
   - keep either the composite FK or the workspace trigger, not both.
9. **`free_delivery` conflicts with D14.** The COD amount is sale·qty + fee, and the fee is never income or cost. "Free delivery" makes the business absorb the ZR fee, which is a new cost. **Fix:** drop the flag from STORE-3, and send the question through `/decide` (it may need the owner). Do not show it as a promise to customers without a DECISIONS row.
10. **Selling tab IA and states are under-specified.** Location: step 5, screens list. **Fix:**
    - Tabs are routes (`[id]/layout.tsx:31-36`), so Selling = a new `[id]/selling/` route plus a layout entry and an i18n key. State its position, title and one-line purpose.
    - Hide it from agents and guard the route.
    - Add a "View on store" link.
    - States: loading skeleton; per-section save error with reason and retry; success feedback; offer delete via `DeleteButton`; per_value/per_variant disabled with a reason when the product has no sizes; confirm before a mode switch discards deltas or overrides.
11. **Editor accessibility, RTL and timezone.** **Fix:**
    - reorder by keyboard with Up/Down buttons that have accessible names (not drag-only);
    - `aria-label` on icon-only buttons;
    - prices `tabular-nums` with LTR isolation; mirrored chevrons;
    - custom field labels stored in the store language (AR-first);
    - the offer window in Africa/Algiers time.
12. **Public form pieces are missing** (per order-form.md):
    - delivery type UI (disabled with "choose wilaya for the price" until P1-7);
    - a summary block with the product total and the saving, and no delivery line;
    - "starting from X" in per_variant mode before a full selection; "+500" delta pills in per_value mode;
    - no pre-selection when there are several choices, and a CTA that scrolls to the missing choice;
    - inline field errors, focus on the first invalid field, phone rule (10 digits, 05/06/07, shown LTR);
    - a native `<select>` for wilaya.

### Low
13. The `product_variants` table has no audit trigger (00042), so `price_override` and `compare_at_override` changes go unaudited. Add a column-scoped audit.
14. The DTO has no variant or offer ids, which STORE-4 needs. Add them now so the snapshot changes once.
15. D58: move the stock rule out of `loadVariants` (`data.ts:136`) into a shared pure function now.
16. Scope the partial unique on `is_default` to `kind='quantity'`. Reuse `store_workspace_immutable()` and `product_id_immutable()`.
17. JSON-LD `price` (`page.tsx:40`) should be the lowest size price once modes exist.
18. Store emoji: reject emoji in custom labels in the zod schema, or strip them on the store ("never emoji on the store").
19. Sticky CTA: safe-area inset, height ≥ 44 px, must not cover the total or the fields. The `#order` target must be focusable.
20. Reword "works without JS": render the server default price, and treat the live price as JS enhancement.

## Missing tests
- The form method is post; no PII is submitted by GET.
- A product save with sale price above the compare price does not 500.
- A negative delta or override makes the size unsellable; no NaN, 0 or negative price is ever rendered.
- An offer worse than qty×unit for a cheap size is hidden or capped; the saving % matches the arithmetic.
- `compare below price hidden` also covers per_value and per_variant.
- Invalid `fields` jsonb written directly still renders defaults with the core fields required.
- Agent cannot UPDATE `products.pricing_mode`/`compare_at_price`, `product_variants.price_override`/`compare_at_override`, or `product_option_values.price_delta`.
- Self-bump, inactive bump and sized bump are left out of the DTO; deleting a bump product does not error.
- `save_variant_config` keeps `price_delta`/`price_override` on re-save (00048:90,96).
- Agent can read offers and sees no cost columns.
- Screens: Selling tab at 390 in light/dark and AR/EN; store form with a validation error; sticky CTA with the keyboard open at 390.
