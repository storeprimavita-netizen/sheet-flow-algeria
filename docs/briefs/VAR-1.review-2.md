VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp-security; live RLS + store DTO suites 58/58, unit 19/19, tsc clean, i18n parity, rolled-back psql probes as admin and agent) and ui-reviewer (live via chrome-devtools: editor 1280 dark, store 390 light AR/RTL, backfill dialog).
DB/RLS/DTO/actions hold: SECURITY INVOKER, advisory lock, admin + id-ownership checks, backfill validation, `not exists`, swatch filtering, size_sets admin-only with USING + WITH CHECK, anon revoked, no cost fields. Review-1 fixes verified (swatch invalid clears, legacy "Variant" mapped on store, store chips 44 px, no overflow at 390).
No high findings. Two medium UI findings block PASS: focus lost after the backfill dialog closes, and "+ Size" offered next to a legacy "Variant" size option (review-1 #5 still open).

## Findings (ranked)

1. **MEDIUM: focus is lost when the backfill dialog closes.** `src/app/(app)/app/products/_components/variants-editor.tsx:413` (conditional `<BackfillDialog>` mount), `backfill-dialog.tsx:64` (`<Dialog open …>`).
   - Failure (observed live): open "+ Size", press Esc; `document.activeElement` is `body`, not the "+ Size" button. Keyboard users restart at the top of the page.
   - Fix: keep a ref to the opener and restore focus via `onCloseAutoFocus` on `DialogContent` (as the deactivate dialog at `:425` already does), or keep the Dialog mounted and drive `open`.

2. **MEDIUM: "+ Size" is enabled on a product that already has the legacy "Variant" option holding S/M/L.** `variants-editor.tsx:305`.
   - Failure (observed live): dialog opens with name prefilled "Size" → product ends with two size-like options. The guard only compares against the localized `t("sizeName")`, so it also misses an EN "Size" in an AR session (qa #6).
   - Fix: treat a text option named "Variant"/"Size"/"المقاس" (case-insensitive, any locale) as the size option, or disable "+ Size" with a visible hint when any text option exists.

3. **LOW: `size_sets.items` accepts a 2-D array.** `supabase/migrations/00068_variant_options_swatches.sql:52`.
   - Failure: `items = array[array['S','M'],array['L','X']]` inserts; `mergeSizeSet` (`i.toLowerCase()`) and `backfill-dialog.tsx` (`l.trim()`) then crash. Admin-only via PostgREST.
   - Fix: add `array_ndims(p_items) = 1` to `size_set_items_ok`.

4. **LOW: moving the colour role between options in one save raises a raw `product_options_one_color` unique violation** (non-deferrable index). RPC-only (no UI kind toggle). Fix: in `save_variant_config` apply kind→text updates before kind→color.

5. **LOW: existing sizes with no value rows skip the new-size validation** (review-1 #7). A value from another option surfaces as 23503 → `in_use`; partial values surface as the completeness trigger's raw text → `failed`. 234/442 local variants have no value rows. Fix: run the new-size check on every size without value rows.

6. **LOW: raw DB messages reach the browser.** `src/app/(app)/app/products/actions.ts:224-233` returns `error.message`, shown by `backfill-dialog.tsx` via `t("failed",{reason})`; settings page passes `sizeSetsError.message`. Admin-only, but leaks constraint names; brief says never raw. Fix: map to codes, log server-side.

7. **LOW: `saveSizeSet` returns `ok:true` when no row matched.** `src/app/(app)/app/settings/actions.ts:599-601` — update with a foreign/missing id affects 0 rows. Fix: `.select("id")` and return `not_found` on empty.

8. **LOW (UI polish):**
   - Editor still labels the legacy option "Variant" (English in AR); reuse the store mapping.
   - "+ Color" disabled with no visible reason; add a hint ("This product already has a Color option").
   - Plus icon + "+ Size" text doubles the plus; drop "+" from EN/AR strings.
   - h2 "Variants" followed by h3 "Variants"; table column "Size" with 2 options → "Combination".
   - Store shows merchant name "Color" in English on AR; map default Size/Color names to store keys like "Variant".
   - Backfill dialog does not mention that missing combinations (N × M) remain to be added.

## Not re-verified (from review-1)
Size-set delete confirmation/error placement, dialog save committing other unsaved edits, size-set textarea `dir=ltr`; Settings → size sets, out-of-stock chip and 8+ value wrap were not driven live this round.

## Missing tests
- Focus returns to the opener after the backfill dialog closes.
- "+ Size" disabled when a legacy "Variant" / other-locale "Size" option exists.
- `size_sets` refuses a 2-D array.
- Colour role moved between options in one save.
- Size with no value rows given another option's value, or partial values → mapped refusal.
- `saveSizeSet` with another workspace's id → not found.
- `loadVariants` swatch filter unit test with a stubbed bad row (DB check currently pre-empts it).
- `kind_clear` via direct PostgREST update of `product_options.kind`.
- Editor payload component test: saved rows + unsaved rows + dialog backfill; swatch field emits null on invalid hex/URL.
- "Use size set" hidden for non-admins; DTO in-stock when only some sizes of a colour have stock, inactive-only value hidden.
