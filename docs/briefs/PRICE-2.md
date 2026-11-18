# PRICE-2 brief — pricing settings + per-product overrides + Pricing tab
risk: high · surface: ui · lane: catalog   (new table + RLS + audit + money)

Goal: the owner edits workspace pricing settings once, overrides any of them per product, and the product Pricing tab shows the live best/medium/worst table from `pricing-v2.ts` (D50/D51/D52).

## Definition of done
- Settings -> new "Pricing" section saves/resets `settings.pricing_defaults` (admin-only, audited); missing/sparse jsonb falls back to `DEFAULT_PRICING_SETTINGS`.
- Table `product_pricing` (one row per product): overrides jsonb, ad costs best/medium/worst (USD, nullable), final price; admin-only RLS, audited.
- Product -> Pricing tab (`products/[id]/pricing/page.tsx`) is pre-filled (stock cost = `product_costs.sourcing_cost_dzd`, quantity = `products.stock` editable in form, final price = saved or `sale_price`), results update live, no NaN/Infinity anywhere ("—" / "Not possible").
- Markup field labelled "Markup % of product cost", typed as percent, stored as fraction, shows resulting profit/piece DZD beside it (D51); mode+value always saved together (D52).
- Same ranges refused before saving as the engine: share 0-100 incl., platform/dead % in [0,100), markup <= 1000%, rates > 0, no negatives.
- "Not possible" shown for a break-even only when profit per piece is known; empty break-even otherwise = "missing input" (D52).
- Gate green; EN/AR parity; no hardcoded colors; both themes screenshotted.

## Files
- `supabase/migrations/00039_product_pricing.sql` (next after 00038): `product_pricing(product_id pk fk products on delete cascade, workspace_id fk, overrides jsonb not null default '{}', ad_best/ad_medium/ad_worst numeric(10,2) check >=0, final_price numeric(12,2) check >0, updated_at)`; RLS enable; policies select/insert/update(USING+WITH CHECK)/delete `workspace_id = public.current_workspace_id() and <admin predicate as used in 00003>`; `set_updated_at` trigger; `audit` trigger (audit_row); no anon grants. Settings needs no migration (jsonb key).
- `src/lib/supabase/database.types.ts`: regen on LOCAL stack only (`supabase gen types --local`; never `--linked`).
- `docs/DB.md`: add `product_pricing` row + `pricing_defaults` settings key.
- `src/lib/settings.ts`: add `pricing_defaults` to SETTINGS_SCHEMAS (zod mirrors PricingSettings, fractions, ranges above) + DEFAULTS = DEFAULT_PRICING_SETTINGS. Check getSetting/DEFAULTS typing (nested object, `target.value` nullable).
- `src/lib/pricing-form.ts` (new, pure): percent<->fraction conversion, zod schema for override form (`.strict`, refuses out-of-range), diff-vs-defaults so only changed fields are stored in `overrides`. Unit tested. No formulas here (only pricing-v2).
- `src/app/app/settings/pricing-section.tsx` + `actions.ts` action `savePricingDefaults` / `resetPricingDefaults` (session client, re-check admin role, zod); register tab in `settings/page.tsx` list.
- `src/app/app/products/[id]/pricing/{page.tsx,actions.ts,pricing-calculator.tsx}`: server page loads settings+costs+product_pricing; client calculator calls `computeAll` live; action `saveProductPricing` (admin re-check, zod, upsert). Reuse `components/fields/*`, `PageHeader/Empty`, `<StatusPill>`/status tokens for BEST/MEDIUM/WORST colours. Include loading skeleton, error + retry, empty ("set a stock cost") states.
- `src/messages/{en,ar}.json`: `pricing.*` new keys (existing `pricing` block at l.414 is BENZ: add under `pricingV2`, do not rename until PRICE-4).
- Drift: current Pricing tab and `/products/planner` use BENZ (`pricing.ts`, `pricing-data.ts`, `scenario-engine.tsx`). Replace only the tab page; leave planner + BENZ libs until PRICE-4 (no third engine, nothing new imports `pricing.ts`).

## Steps (each committed with scripts/step.sh)
1. Migration 00039 + types + DB.md + RLS test.
2. `settings.ts` schema/defaults + `pricing-form.ts` + unit tests.
3. Settings Pricing section + actions (Save/Reset).
4. Product Pricing tab: read-only live table from saved data.
5. Overrides + ad costs + final price form, save action, markup display.
6. i18n AR/EN, states, screenshots (dark/light, EN/AR), PROGRESS note.

## Acceptance tests (names)
- `product_pricing rls: agent cannot select/insert/update/delete`; `admin of other workspace sees none`.
- `pricing_defaults: sparse jsonb falls back to defaults`; `rejects share 101, platform 100, markup 11`.
- `pricing-form: percent in, fraction stored`; `mode and value saved together`; `only changed fields in overrides`.
- `saveProductPricing: agent refused`; `settings save: agent refused`.
- Pinned benz numbers shown by the page at defaults (component test on medium total cost 3,885, price 5,500).
Screens: Settings -> Pricing; Product -> Pricing (empty, populated, below-break-even, error); dark+light, EN+AR(RTL).

## Edge cases / assumptions
- Stock cost 0/missing -> empty state, not "0 price". Quantity 0 -> "—".
- Product with `sourcing_currency` != DZD: use `sourcing_cost_dzd` (generated), spec says stock cost is DZD.
- Native-store preset button sets platform % and monthly fee to 0 (`NATIVE_PLATFORM_PRESET`); workspace default stays 1%/29 per spec table (D50).
- Agents never load settings/product_pricing (admin-only pages; tab hidden for agents).
- Carried follow-ups from PRICE-1 reviews (D52): check logged follow-up row on PRICE-2 in MASTER_PLAN/QUESTIONS before building.
- No new DECISIONS row needed.
