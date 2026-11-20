VERDICT: ESCALATE

## Summary
Review 3 (qa-reviewer + ui-reviewer). No high findings, and the database wall holds: 79/79 live RLS, DTO and unit tests pass and tsc is clean. Rolled-back psql probes confirm the backfill, swatch checks, size_sets RLS and SECURITY INVOKER behave as the brief says. Two medium findings remain, and this is review 3 without a PASS, so the verdict is ESCALATE. The brief also contradicts its own test on value-less variants, and the owner needs to decide which is right.
The ui-reviewer checked the code only this round and took no new screenshots, so several store and settings states are still unverified in a browser.

## Findings (ranked)

1. **MEDIUM: the Arabic store shows English option names.** `src/components/store/product-view.tsx:85`
   - Only the legacy name `"Variant"` is mapped to `st("sizes")`.
   - "+ Size" and "+ Color" store the default name in the admin's UI language. An owner using the English back office therefore makes every Arabic customer see "Size" and "Color" on the product page.
   - Fix: when `isSizeOption(o)` is true, show `st("sizes")`. When `kind==='color'` and the name is a default one, show a new store colour key. Add both keys to EN and AR.

2. **MEDIUM: raw database error messages reach the browser.**
   - `src/app/(app)/app/products/actions.ts:226-233` returns `error.message` to the client, and so do `:127` and `:177`. The editor shows it through `t("failed",{reason})` in `variants-editor.tsx:185` and `backfill-dialog.tsx:55-60`.
   - `settings/page.tsx` passes `sizeSetsError.message` into the UI.
   - The result: constraint, table and trigger names are shown to users. The brief says refusals are never raw.
   - Fix: return codes only, log details on the server, and show a translated generic reason.

3. **LOW: `size_sets.items` accepts a 2-D array.** `supabase/migrations/00068_variant_options_swatches.sql:49` (`size_set_items_ok`)
   - Confirmed live: `array[array['S','M'],array['L','XL']]` is inserted.
   - After that, `.trim()` crashes in `backfill-dialog.tsx:46` and in `mergeSizeSet`.
   - Fix: add `array_ndims(p_items) = 1` to the check, in a new migration.

4. **LOW: `saveSizeSet` returns `ok:true` when no row matched.** `src/app/(app)/app/settings/actions.ts:~599`
   - An update with a foreign or missing id affects 0 rows and still reports success.
   - Fix: add `.select("id")` and return `not_found` when the result is empty.

5. **LOW: "Use size set" can drop a value that variants use.** `variants-editor.tsx:~289`
   - Values with blank labels are filtered out, including a used value the owner has just blanked. Save is then refused with `in_use`.
   - `mergeSizeSet` compares labels without trimming them, so "S " and "S" produce `duplicate_value`.
   - Fix: keep used values, and trim labels before merging.

6. **LOW: moving the colour role between two options in one save fails.** The save hits the non-deferrable `product_options_one_color` index and raises a raw unique violation. This is only reachable through a direct RPC call. Carried over from review 2.

7. **LOW: sizes with no value rows skip the new-size check.** A partial payload ends in the raw completeness-trigger error, which is shown as `failed`. Carried over from review 2.

8. **LOW: the backfill dialog's count can be wrong.**
   - It counts the saved rows in this browser tab, while the database backfills every size that has values.
   - If another tab added a size in the meantime, the count is off, and a refusal shows the raw message.

9. **LOW: option names are not unique.** "Add option" with the name "Size" gets past the `isSizeOption` guard, and the database has no `(product_id, lower(name))` unique index.

10. **LOW: UI polish left over from review 2.**
    - "+ Color" is disabled with no visible reason (`variants-editor.tsx:314`).
    - The column is still headed "Size" when there are 2 options (`:351`).
    - "Variant" is shown untranslated in the Arabic editor.
    - The backfill dialog does not say that the missing N x M combinations still need adding.
    - Size-set delete uses `window.confirm`, not the app's Dialog (`size-sets-section.tsx:61`).
    - Plan row VAR-1-B in `docs/MASTER_PLAN.md` says the screenshots were not taken, but they exist now.

11. **INFO:** swatch photos load from third-party hosts. Add `referrerPolicy="no-referrer"` to the store `<img>`.

## Owner decision needed
- The brief's Tests list says a "value-less variant" must be "refused incomplete". `variants.rls.test.ts:~660` asserts that it passes instead. Decide which behaviour is right, then align either the brief or the code and test.

## Missing tests
- DTO: a colour is in stock when only some of its sizes have stock.
- DTO: a value used only by inactive variants is hidden.
- `loadVariants` filters out a bad swatch row (use a stubbed row, because the database check blocks bad rows first).
- `size_sets` refuses a 2-D array.
- `saveSizeSet` with another workspace's id returns not_found.
- The colour role moved between options in one save gives a mapped refusal.
- A partial payload where a size has no value rows gives a mapped refusal.
- A component test for the editor payload.
- "Use size set" is hidden for non-admins.
- Not yet verified in a browser:
  - the settings size-set screens in light theme and AR;
  - the out-of-stock chip;
  - the wrap with 8 or more values;
  - Esc in the backfill dialog returning focus to the opener;
  - store chip tap targets at 390 px.
