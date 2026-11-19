VERDICT: FIX
## Summary
Brief review (qa-reviewer + ui-reviewer). The design is sound: migration 00068 is free, 200-variant backfill runs in about 84 ms under the deferred triggers, and the function stays SECURITY INVOKER. But the brief leaves gaps the builder will hit: zod blocks every backfill save, the stale vs in_use rule contradicts itself, backfill ownership and ordering are unspecified, photo swatches can inject CSS, and the store chip DTO for multi-option products is undefined. Amend the brief, then build.

## Findings (ranked)

1. **Medium (security): photo swatch CSS injection.** Brief lines 24 and 29, `src/components/store/product-view.tsx:87`. The `^https://` check plus "inline style" invites `background-image:url(${x})`. A value like `https://a/x.png);position:fixed;inset:0;background:url(https://evil/p.png` puts an overlay on the public product page.
   Fix:
   - Draw photos with `<img src>` only. Only a validated hex goes into `style`, as a custom property (`style={{"--swatch": hex}}` with `background: var(--swatch)` in CSS).
   - DB check `^https://[^\s"'()<>\\]{1,2040}$`; zod uses `httpsUrl` (`src/lib/store/url.ts`).
   - `loadVariants` filters again with `isHttps`.

2. **Medium: zod rejects every backfill save.** `src/lib/variants.ts:60-64` requires every payload variant to have a value for every payload option. Saved variants sent from `variants-editor.tsx:87` lack the new option, so the action returns `invalid` before the RPC runs.
   Fix: the client copies `backfill[newOpt]` into each saved variant's `values`, and zod checks that the copied value equals the backfill. Do not delete the refine.

3. **Medium: the stale vs in_use rule contradicts itself.** On a product with variants, every option is used by every variant. So "every existing option id must be in the payload" always fires first, and the DoD and the test "removing used option still in_use" can never get `in_use`.
   Fix: write the rule down:
   - A missing existing option on a product with variants raises `stale`.
   - With no variants, removing an option stays free.
   - A new option without a backfill raises `incomplete size`. Rewrite `src/lib/variants.rls.test.ts:462` from `stale` to `incomplete size` and keep `:458` as `stale`. Name these changes in the brief so nobody deletes a test to get the gate green.
   - The in_use test must target removing a used *value*, not an option.

4. **Medium (security): backfill ownership and ordering are unspecified.**
   Fix:
   - Require `jsonb_typeof(backfill)='object'`.
   - Every key must be a NEW payload option id; refuse keys for existing options.
   - Every value must be a payload value of that same option.
   - Anything else raises `incomplete size`, not a raw 22023/22P02/23503 error mapped to `failed` or `in_use`.
   - Backfill only the variants that existed before the variant upsert: run it before the `product_variants` insert, or snapshot the ids first.
   - Use `not exists`, never `NOT IN`, because a null id inside `NOT IN` makes the check pass silently.

5. **Medium (ui): the store chip model for multi-option products is undefined.** `product-view.tsx:83-91` renders one `<li key={v.label}>` per variant. With Size × Color, labels collide and one swatch cannot represent a combination.
   Fix: pick the DTO shape. Either `options[{name, kind, values[{label, swatch, inStock}]}]` with one chip row per option, or per-variant chips keyed by id. Say how a colour's in-stock status is derived across sizes.
   Chip rules either way:
   - The text label stays on every chip; colour is never the only signal.
   - The dot has a store-token border.
   - Out of stock shows as strike-through or opacity plus the sr text.
   - Tap target is at least 44 px at 390 px.
   - Photo swatches use `<img alt="" loading="lazy">` with fixed width and height.
   - No JS on the store.

6. **Medium (ui): the swatch picker has no field component.** A native `<input type=color>` in `_components` breaks the no-raw-input rule.
   Fix: build `swatch-field.tsx` in `components/fields/`:
   - A hex text input with `dir=ltr`, a preset palette of buttons, each with an `aria-label`.
   - Native `type=color` only inside that component, as a documented exception.
   - Photo-URL mode with a live preview, a validation message and an error state.

7. **Medium (ui): the backfill dialog is underspecified.** It needs:
   - Radix Dialog with focus trap and Escape.
   - Cancel leaves no half-added option.
   - A required Radix Select, with confirm disabled until a value is chosen.
   - The consequence text "N variants will get <value>".
   - A saving state, and error plus retry on `stale` or `incomplete`.
   - Handling for an option with zero values (create the first value inside the dialog).

8. **Medium (ui): size sets are missing roles and states.**
   - Settings section: loading, empty with an action, error with retry, and a duplicate name shown as a field error.
   - The editor's "Use size set" must hide for non-admins, or load through an admin-scoped path.
   - Say whether applying a set replaces or merges existing values, and how values already in use are handled.

9. **Low:** keep the function SECURITY INVOKER (00067:38). Under definer, the `current_user='authenticated'` completeness rule at 00067:22 turns off. The trigger that enforces the backfill is `product_options_complete` (00048:31).

10. **Low:** a variant with no value rows (D55) would get one backfill row and fail completeness. Backfill only variants that have value rows, or refuse with a clear code.

11. **Low:** `size_sets` should follow the `00061_seasons.sql` pattern:
    - a `workspace_immutable` trigger;
    - `revoke truncate, trigger, references` from `authenticated`;
    - a unique index on `(workspace_id, lower(name))`.
    Choose `text[]` with checks: 1 to 40 items, each trimmed, non-blank, at most 60 characters.

12. **Low:** swatches:
    - At most one of `swatch_color` / `swatch_image`.
    - Only on values of `kind='color'` options; cleared when kind changes to text.
    - At most one color option per product.

13. **Low:** existing `orders.variant` text ("M") stays while `variant_label()` becomes "M / Red". Pin this with a test.

14. **Low (ui):**
    - Latin values in the editor (hex, URL, SKU, sizes) need `dir=ltr` / `<bdi>`.
    - SKU auto-fill: say how Arabic values become initials (transliterate or fall back to an index), define the uniqueness suffix, and never overwrite an edited SKU without confirmation.
    - Show a combination-count warning (N × M).
    - Icon-only buttons get an `aria-label`.
    - The editor swatch dot needs a border token in both themes.

## Missing tests
- Saved variants, a new option and new variants in one payload: passes zod and the RPC.
- Backfill keyed by an existing option, a non-object backfill, a value of another option, a value-less variant: each refused with the specified code.
- Stale tab (option added in tab B, tab A saves) gets `stale`; in_use on removing a used value; the rewritten expectations from finding 3.
- Agent cannot read or write `size_sets`; anon has no grant; another workspace's sets are invisible.
- After backfill, `variants.id`, stock, `is_active`, `orders.variant_id` and `orders.variant` text are unchanged.
- Swatch: an https URL containing `)`, quotes or whitespace is refused by the DB and zod; `javascript:` is refused; the DTO drops a bad URL; the DTO has no cost fields and excludes unpublished products.
- Service role inserting an option directly is still refused (keep the `:526` test).
- Unit tests: `skuSuggestion` with Arabic values and collisions; the backfill zod refine.
- Screenshots: light-theme swatches; size-sets empty and error states; the 390 px store row with 8+ values wrapping; the AR store page; the backfill dialog in AR; an out-of-stock colour chip.
