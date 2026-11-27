# VAR-1-F — Size set confirmation and option hints

risk: low · surface: ui · lane: store

Goal: Make size set deletion and unavailable Size and Color shortcuts clear in the back office.
Basis: STORE back-office options, D76, D93 and VAR-1 review 4 findings 1–2.

## Done when

- Settings → Options opens a themed Radix Dialog naming the selected size set. Cancel, Escape and Close dismiss it without deleting. Confirm deletes that set once and refreshes the list. A failed deletion shows a localized error and can be retried. A set is a reusable list of names, so product options and variants keep the values they already use.
- The product Options editor visibly explains when a size or color option already exists. The hints work with touch and in EN and AR. At the three-option limit or with unsaved changes, the existing reason takes precedence. With room and saved changes, the other shortcut remains available.

## Files and pushed steps

1. `src/app/(app)/app/settings/size-sets-section.tsx` — use the app's Radix Dialog as in `src/app/(app)/app/catalog/products/_components/backfill-dialog.tsx`. Track the selected row and reuse `deleteSizeSet`. Focus Cancel on open, restore focus to the trigger on dismissal, and move focus to the list heading or Add button after successful deletion if the trigger disappears. Disable repeat confirmation and dismissal while pending. Keep failures inside the dialog with a delete-specific message and clear them when reopening or retrying. Reuse the localized confirmation with the set name and handle mixed-direction names. Update `src/messages/{en,ar}.json` with matching keys. Push the dialog step.
2. `src/app/(app)/app/catalog/products/_components/variants-editor.tsx` — use `options.some(isSizeOption)` and the existing `hasColor` for both the disabled state and the localized hints. Show adjacent text for the affected shortcuts and keep the layout readable when it wraps. Add matching `variants` keys in `src/messages/{en,ar}.json`. Push the hints step.

The canonical product path is `/app/catalog/products/[id]`. The old review path predates the route move. The shared `DeleteButton` still uses a native confirm, so use the Radix pattern already in the variants editor. The existing admin action and `size_sets` policies in migration 00068 cover the mutation. Scope is the two UI changes from D93, with no migration or new decision.

## Acceptance

- **Size set dialog** — at `/app/settings?section=options`, create two disposable local sets. Cancel on one and confirm on the other. Verify focus, the surviving row, the empty state after deleting the last set, and failure/retry feedback with a failed request. Check keyboard navigation and a mixed-direction set name.
- **Option shortcut hints** — in the Options editor at `/app/catalog/products/[id]`, check a product with neither option, Size only, Color only and both. Include a legacy `Variant` size name. Check the option limit, unsaved changes and the existing backfill flow for the available shortcut.
- Run `scripts/gate.sh`. Regression cases in `src/lib/variants.test.ts` include “treats legacy Variant and any-locale Size as the size option” and “ignores colour options and other names”.
- Capture the open size set dialog and the option shortcuts with visible hints in EN and AR, dark and light, at 390 and 1280 px. Record the screenshot self-critique in PROGRESS.md and send the diff for independent UI review.
