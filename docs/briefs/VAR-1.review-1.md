VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp-security; live RLS suite + store DTO tests 58/58 pass, rolled-back psql probes) and ui-reviewer.
DB layer holds: SECURITY INVOKER, advisory lock, admin and id-ownership checks, backfill validation (object, new-option keys only, same-option values, `not exists`), swatch regex matches zod and DTO, size_sets RLS is admin-only per workspace, anon revoked, no cost fields in the DTO, swatches drawn only via `<img src>` or a validated hex custom property.
No high findings. Four medium findings in the editor, the store and settings UX block PASS. The worst: the backfill dialog can loop forever on `invalid` when unsaved sizes exist.

## Findings (ranked)

1. **MEDIUM: the backfill dialog fails forever when unsaved rows exist, and it silently commits other unsaved edits.** `src/app/(app)/app/products/_components/variants-editor.tsx:135` (`confirmAdd`), `:125` (`startAdd`).
   - Failure: a product has saved sizes S and M. Add value L, click "Add missing", then "+ Color", pick Red, click Add.
   - `confirmAdd` copies the backfill value only into rows where `v.saved` is true (`:135`). The unsaved L row lacks the new option, so the zod refine in `src/lib/variants.ts` (every variant has every option) returns `invalid`.
   - The dialog shows "backfillInvalid". Retry sends the same payload and fails again. A pending blank value placeholder causes the same failure.
   - When the dialog save does succeed, it also commits every other unsaved edit (renames, SKUs, deleted values). That breaks the brief's "Cancel adds nothing" / dialog-scoped intent.
   - Fix: disable "+ Size" / "+ Color" / "Add option" while `unsaved`, with the hint "Save or discard your changes first". Or build the dialog payload from the saved state only, plus the new option.

2. **MEDIUM: an invalid swatch input keeps the old swatch, and Save persists it.** `src/components/fields/swatch-field.tsx:61-64,107-110`.
   - Failure: the value is `#aa0000`. The owner types `#12`. The field shows an error, but `onChange` is never called, so editor state keeps `#aa0000`. Save writes the old colour without any sign.
   - The photo-URL input behaves the same way: a half-typed URL keeps the previous image.
   - Fix: on invalid input, emit an invalid marker that blocks Save, or emit null with an inline error. Keep never-both by clearing the other mode's value on a mode switch.

3. **MEDIUM: the legacy option name "Variant" shows in English on the AR store.** `src/components/store/product-view.tsx:86`.
   - The row heading is now the raw `o.name`. Options created by the 00043 default are named "Variant", so Arabic customers see an English label (the builder's own `store-chips-ar-light-390.png` shows this).
   - The previous localized `st("sizes")` heading is gone.
   - Fix: map the legacy default name to `st("sizes")` in the DTO or view, or rename it in a migration and backfill.

4. **MEDIUM: deleting a size set fails silently and has no confirmation.** `src/app/(app)/app/settings/size-sets-section.tsx:50-55,98,118`.
   - `remove()` reports failure through `setFieldError`. That error renders only inside the edit form (`:118`), so a failed delete with no form open shows nothing.
   - Delete fires in one click, with no confirmation.
   - Fix: show the error at section level (role=alert) and use the confirm pattern `DeleteButton` already provides.

5. **LOW: option names are not unique; duplicate React keys on the store.** `product-view.tsx:85` (`key={o.name}`) and `variants-editor.tsx:305`.
   - The "+ Size" guard compares against the localized `t("sizeName")`, so an AR session does not catch an EN "Size". Two options both named "Size" give duplicate keys and confusing rows.
   - Fix: validate names case-insensitively for uniqueness in zod and the dialog. Key store rows by index or option id.

6. **LOW: a kind change or a colour-role move is not handled in one save.** `supabase/migrations/00068_variant_options_swatches.sql:10,33-44`.
   - Changing color to text while values keep swatches raises 'swatch needs a color option' before `kind_clear` runs.
   - Moving the colour role from option A to option B hits the non-deferrable `product_options_one_color` index.
   - Both are reachable only through a direct RPC today, since the UI has no kind toggle. The brief's "cleared if kind becomes text" is untested.
   - Fix: clear swatches in the function when the payload kind is text. Add tests.

7. **LOW: a size with no value rows skips the new-size check.** `00068:224-228`.
   - A bad key ends as a raw 23503 error, which is mapped to `in_use`. The test at `variants.rls.test.ts:680` passes because of this path, not because the backfill skips that size.
   - Fix: apply the new-size validation to every size that has no value rows.

8. **LOW: the dialog's count can differ from the database.** The "N variants will get X" text counts only this tab's saved sizes. The DB backfills every size that has value rows. Data is correct; only the text can be wrong.

9. **LOW: size-set items.**
   - No case-insensitive dedupe; an item cannot contain a comma.
   - The textarea is `dir="ltr"` even for Arabic sizes (use `dir="auto"`).
   - No loading skeleton for the size-sets section.

## Missing tests
- Editor payload: saved sizes, unsaved new sizes and a dialog backfill together (would catch #1).
- SwatchField: invalid hex or URL input is not persisted (#2).
- `kind_clear` clears swatches; moving the colour role between options in one save (#6).
- `saveSizeSet` with another workspace's id: it currently returns `ok: true` with no change and should return not found.
- DTO: a colour value's in-stock status when only some of its sizes have stock; a value used only by inactive variants is hidden.
- Component check: the "Use size set" button is hidden for non-admins.
- Unverified live: dark-theme contrast, Escape and focus return in the backfill dialog, wrap at 8+ values. The ui-reviewer did not drive the browser.
