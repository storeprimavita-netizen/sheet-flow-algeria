risk: high · surface: ui,security · lane: store
(high: migration + RLS + the save function that rewrites variants; D76 replaces D55.)

## Goal
The owner adds a Size or Color option to a product that already has sizes, picks the value existing variants get, and sets colour swatches, free size names and reusable size sets.

## Definition of done
- "+ Size" and "+ Color" buttons sit beside "Add option"; the old "options cannot be added once sizes exist" lock is gone.
- Adding an option to a product with variants needs a chosen backfill value; one transaction gives every existing variant that value. Stock, SKU, `is_active`, `variants.id` and `orders.variant_id` unchanged.
- Removing an option or value that variants use is still refused (in_use). Variants' existing value rows never change.
- Color option: each value has a swatch (hex or https photo URL, never both; only on `kind='color'` options, max one per product, cleared if kind becomes text); public DTO carries it.
- Size sets (`text[]`, 1-40 items, trimmed, non-blank, <=60 chars): Settings -> Options lists them; "Use size set" MERGES into the option (existing values kept, used ones untouched); button hidden for non-admins; admin-only.
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
   - Replace `save_variant_config`: payload gains `options[].kind`, `values[].swatch_color|swatch_image`, `backfill {option_id: value_id}`. Replace the `stale` check by: RULE: a missing existing option on a product WITH variants -> `stale` (no variants: removal stays free); a new option without backfill -> `incomplete size`. Backfill must be `jsonb_typeof='object'`, keys = NEW payload option ids only, each value = a payload value of that same option; anything else -> `incomplete size` (never raw 22023/22P02/23503). Snapshot pre-existing variant ids (only those having value rows) BEFORE the variant upsert, then insert backfill rows with `not exists` (never NOT IN). Keep SECURITY INVOKER (00067:38; definer disables the `authenticated` completeness rule), advisory lock, admin check, id ownership checks. Swatch checks: image `^https://[^\s"'()<>\\]{1,2040}$`, at most one of colour/image. size_sets also follow 00061_seasons.sql: `workspace_immutable` trigger, `revoke truncate, trigger, references`, unique index (workspace_id, lower(name)).
2. `src/lib/variants.ts`: zod for kind, swatch (hex or `httpsUrl` from `src/lib/store/url.ts`), `backfill`. Keep the every-variant-has-every-option refine: the client copies `backfill[newOpt]` into each saved variant's `values`, and zod checks the copy equals the backfill. Add `skuSuggestion()` (Arabic values: fall back to index; collisions get -2, -3; never overwrite an edited SKU without confirm).
3. `src/app/(app)/app/products/actions.ts`: pass new fields; map new refusals; add `size_sets` actions in `settings/actions.ts` (zod, admin re-check).
4. `variants-editor.tsx` + `src/components/fields/swatch-field.tsx`: quick buttons, kind-aware rows, title switch, SKU hint/button, N x M combination warning, aria-label on icon buttons, `dir=ltr`/`<bdi>` on hex/URL/SKU/sizes. swatch-field: hex text input (ltr) + preset palette buttons (aria-label) + photo-URL mode with live preview and error; native `type=color` only inside it (documented exception). Backfill dialog: Radix Dialog (focus trap, Esc), Cancel adds nothing, required Radix Select (confirm disabled until chosen), text "N variants will get <value>", saving state, error + retry on stale/incomplete, option with zero values -> create first value in dialog. Size-set picker loads via admin-scoped path.
5. `src/lib/catalog/variants-data.ts` + page: load kind and swatches. `src/lib/store/data.ts`, `product-view.tsx`: DTO becomes `options[{name, kind, values[{label, swatch, inStock}]}]`, one chip row per option; a value is inStock if any active variant with it has stock; `loadVariants` re-filters swatches with `isHttps`. Chips: text label always shown (colour never the only signal), dot with store-token border, out of stock = strike-through + sr text, tap >= 44 px at 390, photo = `<img alt="" loading="lazy" width height>`, NEVER `background-image:url()`; only a validated hex goes in `style={{"--swatch":hex}}`. No JS.
6. `settings/size-sets-section.tsx` (loading skeleton, empty+action, error+retry, duplicate name = field error) + `docs/DB.md` + regen `database.types.ts`; `src/messages/{en,ar}.json`.

## Steps (each commit+push)
1 migration + types + DB.md; 2 variants.ts + action + rls tests; 3 editor quick buttons + backfill; 4 swatches + DTO + store chips; 5 size sets; 6 SKU + titles; 7 screenshots.

## Tests
Rewrite `variants.rls.test.ts:462` from `stale` to `incomplete size` (keep :458 `stale`, keep :526 service-role refusal); no test deleted. Additions: "adds colour option to product with sizes keeps stock and ids", "missing backfill refused", "backfill value of another option refused", "agent cannot call save or write size_sets", "other workspace invisible", "removing used VALUE still in_use", "removing option on variant product stale", "saved+new option+new variants in one payload passes", "backfill keyed by existing option / non-object / foreign value / value-less variant refused incomplete", "orders.variant text unchanged", "swatch url with ) quote space or javascript: refused (DB+zod+DTO)", "order variant_id unchanged", "swatch rejects non-https and bad hex"; unit tests for backfill refine and `skuSuggestion` (Arabic, collisions); DTO test "no cost fields, swatch present".

## Screenshots
Catalog -> product -> Options: empty, saved product with backfill dialog, Color with swatches; Settings size sets; store product page with swatch chips. EN/AR, dark/light, 390 px and 1280; plus size-set empty/error, AR backfill dialog, 8+ value wrap, out-of-stock chip.

## Edge cases
Backfill on a 200-variant product; two saves racing (advisory lock); a colour added when a Size option exists makes combos x N: "Add missing" must not auto-create; max 3 options still holds; duplicate swatch colours fine.

## Gaps (not DECISIONS-blocking, decided here)
- "Store -> Forms & offers" does not exist on v3 (STORE-3 is blocked, unmerged), so the "Edit options" link and a real colour picker wait for STORE-3: add a follow-up row, link target = product page options anchor for now. No new D-row needed.
- Swatch photo = https URL (no storage bucket, no new service).
