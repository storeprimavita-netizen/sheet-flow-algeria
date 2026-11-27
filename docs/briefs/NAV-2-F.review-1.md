VERDICT: FIX

## Summary
UI review of `git diff v3...v3-NAV-2-F` (ui-reviewer, app run locally). Order not-found/subtitle and money `related` removal pass.
The 390 px record-name criterion is not met, the record crumb is lost on product tab switch, and the builder's screenshot matrix is absent.
Coverage was partial: most screens by DOM measurement, admin mainly EN dark and AR light at 390 px. Gate not run (14 test files, 117 tests pass).

## Findings

1. **Medium: record crumb disappears on product tab switch** (all themes/locales, 390 and 1280)
   - Where: `src/components/breadcrumbs.tsx:27` and `:43-46`; `CrumbRecord` is in `catalog/products/[id]/layout.tsx:44`.
   - Failure: open `/app/catalog/products/<id>`, click Pricing. Trail reads "Catalog > Products" with no name until reload. The layout stays mounted, the effect does not re-run on a path change, and the record stored for the old path is dropped.
   - Origin: present on v3 before this diff, but it breaks the pricing "Done when".
   - Fix: re-run the effect on path change (`usePathname()` in `CrumbRecord`'s dependencies) or stop keying the record by exact path. Keep `set` stable and recheck for the render loop.

2. **Medium: record name still unreadable at 390 px** (pricing, EN dark and AR light)
   - Where: `src/components/breadcrumbs.tsx:76`; header at `src/components/app-shell.tsx:425-426`.
   - Failure: the trail gets about 152 px. EN shows "... > Prod... > Robe Z...", cutting even a short name and the parents. AR loses "Abaya Luxe", the identifying start of the name. Store preview crumbs are all stubs (record 15 of 72 px EN, 22 of 72 AR). `title` does not help on touch.
   - Fix: free header width (hide the brand wordmark below `sm`) or drop middle crumbs there. Add `dir="auto"` on the truncating element (`breadcrumbs.tsx:80-86`) so truncation keeps the start of the name.
   - Shots: `docs/design/audit/NAV-2-F/pricing-en-dark-390.jpeg`, `pricing-ar-light-390.jpeg`.

3. **Medium: screenshot matrix not delivered**
   - Where: brief "Done when" and "Screenshots"; `docs/design/audit/NAV-2-F/` has nothing in `git diff v3...v3-NAV-2-F`.
   - Failure: the truncation fix was never seen on screen by the builder, which is how finding 2 got through. The only two shots are the reviewer's.
   - Fix: after fixing 1 and 2, take the brief's matrix and fix what it shows; state any skipped screen.

4. **Low: long record hides "Preview"** (store preview, 700 px EN, long name simulated in the browser)
   - Where: `src/components/breadcrumbs.tsx:76`.
   - Failure: `sm:shrink-0` lets the record take 582 px of a 386 px trail; the record is clipped and the tail vanishes. No horizontal page scroll.
   - Fix: let the record shrink when a tail follows.

## Missing tests
- Record survives a path change under a persistent layout (finding 1).
- Found-order subtitle per role, and platform reference taking precedence (`sell/orders/[id]/page.tsx:160-168`); the new test covers only not-found.
- Money pages have no `related` row.
- Breadcrumb `title` and truncation.

## Not checked or partly checked
- Full theme x locale x width matrix by eye; admin not-found; Ad spend and Accounts at 390 px EN; hub colours and contrast; loading and error states; full keyboard order.
- No long product name in the seed: a local DB rename was denied by the permission classifier and not retried; seeded names and browser-only text substitution were used.
- One React "state update before mount" console error appeared during scripted navigation, not attributed. Hard-loaded pages were clean.
