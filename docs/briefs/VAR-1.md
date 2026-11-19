risk: high · surface: ui,security · lane: store
(high: migration + RLS + the save function that rewrites variants; D76 replaces D55.)

## Goal
The owner adds a Size or Color option to a product that already has sizes, picks the value existing variants get, and sets colour swatches, free size names and reusable size sets.

## Definition of done
- "+ Size" and "+ Color" buttons sit beside "Add option"; the old "options cannot be added once sizes exist" lock is gone.
- Adding an option to a product with variants needs a chosen backfill value; one transaction gives every existing variant that value. Stock, SKU, `is_active`, `variants.id` and `orders.variant_id` unchanged.
- Removing an option or value that variants use is still refused (in_use). Variants' existing value rows never change.
- Color option: each value has a swatch (colour picker hex or https photo URL); the public DTO carries it and the store product page shows it on the size chips.
- Size sets: Settings -> Options lists named sets (name + values); "Use size set" fills a Size option; admin-only.
- Title is "Variants" when options > 1, else "Sizes". SKU hint + auto-fill button (product code + value initials, unique per product, editable). EN + AR strings, parity.

## Real code found (plan drift)
- `save_variant_config` last in `00067`; it raises `stale` if option ids differ once a variant exists (`variants-editor.tsx:63 locked`). Constraint trigger `product_variants_complete` is deferred, so backfilling inside the same transaction passes; the `authenticated` path also refuses variants with no value rows.
- Variants are `product_variants` + `product_variant_values (variant_id, option_id)` PK, composite FKs. Public DTO: `loadVariants` in `src/lib/store/data.ts` returns `{label, inStock}` only; `product-view.tsx:83` renders a flat chip list. There is NO colour picker yet.
- Settings -> Options (`options-section.tsx`) is the fixed 5-key `option_sets` (category, fabric...), not product options; size sets need their own table.
- No storage bucket exists anywhere; photos are pasted https URLs (`products.images`). Swatch photo follows that: https URL, no upload.

## Files and change
1. `supabase/migrations/00068_variant_options_swatches.sql` (next free number; STORE-3 branch may also claim one, renumber on merge):
   - `product_options.kind text not null default 'text' check (kind in ('text','color'))`.
   - `product_option_values.swatch_color text check (~ '^#[0-9a-fA-F]{6}$')`, `swatch_image text check (~ '^https://')`; length caps.
   - `size_sets (id, workspace_id FK, name, values jsonb|text[] , position, created_at, updated_at)`: unique (workspace_id, lower(name)); RLS admin + `workspace_id = current_workspace_id()`, USING + WITH CHECK; `set_updated_at` trigger; `audit_row()` trigger; revoke anon grants.
   - Replace `save_variant_config`: payload gains `options[].kind`, `values[].swatch_color|swatch_image`, `backfill {option_id: value_id}`. Replace the `stale` check by: every existing option id must be in the payload (no removal there; deletion still hits FK in_use), each NEW option on a product with variants needs a backfill value that belongs to it, else `incomplete size`. After the option and value upserts, insert the backfill value row for every existing variant lacking that option. Keep the advisory lock, admin check, id ownership checks.
2. `src/lib/variants.ts`: zod for kind, swatch (hex or https), `backfill`; `variantStatus` helpers untouched; add `skuSuggestion()`.
3. `src/app/(app)/app/products/actions.ts`: pass new fields; map new refusals; add `size_sets` actions in `settings/actions.ts` (zod, admin re-check).
4. `variants-editor.tsx` (+ `swatch-field.tsx` in `_components`): quick buttons, kind-aware value rows, backfill picker dialog when adding to a saved product, title switch, SKU hint/button, size-set picker. Use `components/fields`, Lucide, tokens; swatch colour is user data, set via inline style only.
5. `src/lib/catalog/variants-data.ts` + page: load kind and swatches. `src/lib/store/data.ts`, `product-view.tsx`: add `swatch` to DTO (no cost fields), render a dot or photo on chips, AR RTL, `<bdi>`.
6. `settings/size-sets-section.tsx` + `docs/DB.md` + regen `database.types.ts`; `src/messages/{en,ar}.json`.

## Steps (each commit+push)
1 migration + types + DB.md; 2 variants.ts + action + rls tests; 3 editor quick buttons + backfill; 4 swatches + DTO + store chips; 5 size sets; 6 SKU + titles; 7 screenshots.

## Tests
`variants.rls.test.ts` additions: "adds colour option to product with sizes keeps stock and ids", "missing backfill refused", "backfill value of another option refused", "agent cannot call save or write size_sets", "other workspace invisible", "removing used option still in_use", "order variant_id unchanged", "swatch rejects non-https and bad hex"; unit tests for schema and `skuSuggestion`; DTO test "no cost fields, swatch present".

## Screenshots
Catalog -> product -> Options: empty, saved product with backfill dialog, Color with swatches; Settings size sets; store product page with swatch chips. EN/AR, dark/light, 390 px and 1280.

## Edge cases
Backfill on a 200-variant product; two saves racing (advisory lock); a colour added when a Size option exists makes combos x N: "Add missing" must not auto-create; max 3 options still holds; duplicate swatch colours fine.

## Gaps (not DECISIONS-blocking, decided here)
- "Store -> Forms & offers" does not exist on v3 (STORE-3 is blocked, unmerged), so the "Edit options" link and a real colour picker wait for STORE-3: add a follow-up row, link target = product page options anchor for now. No new D-row needed.
- Swatch photo = https URL (no storage bucket, no new service).
