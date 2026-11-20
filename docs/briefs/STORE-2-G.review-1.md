VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp-security) and ui-reviewer, on `git diff v3...v3-STORE-2-G`.
The code meets DoD 1-12. No security issue was found. The live RLS suite passes 8/8 and the touched unit tests pass 44/44.
Two medium gaps block PASS. DoD 13's store screenshots are incomplete, and the StorePhoto pre-hydration case is never rendered.
DoD 6 (zero-row publish) and DoD 7 have no tests.

## Findings (ranked)

1. **Medium: DoD 13, `docs/design/audit/STORE-2-G/`. The store product page screenshots are incomplete.**
   - The brief asks for the store page with a broken image AND a working image, in EN+AR, light+dark, at 390+1280.
   - What exists: 4 `store-jupe-*` files and only 2 broken-image files (`store-veste-broken-1280-dark`, `store-veste-broken-390-light`).
   - No store filename names its locale, so the AR/EN coverage cannot be checked.
   - Two DoD items are never shown:
     - the related-card placeholder (DoD 9);
     - the `.store-buy` column aligned to start next to a hidden `#order` at 1280 (DoD 12).
   - Fix: capture the full matrix with the locale in each filename, for example `store-<slug>-<broken|ok>-<en|ar>-<390|1280>-<light|dark>.png`.

2. **Medium: `src/components/store/photo.test.tsx`. The StorePhoto test never renders.**
   - It mocks the React hooks and calls the component function directly.
   - It never mounts in a DOM. So the case the brief singles out, an image that fails before hydration (`ref.complete && naturalWidth===0`), is never exercised.
   - Fix: add a render test (jsdom or happy-dom, or the existing render harness used by `store-errors.test.tsx`). It should cover two cases:
     - `onError` swaps in `.store-photo-empty`;
     - an already-failed image at mount shows the placeholder.

3. **Low: `src/components/store/product-view.tsx:19`. The alt text is lost when an image block fails.**
   - The image block gets no `emptyLabel`, and the fallback placeholder is `aria-hidden`.
   - So the alt text the admin typed is lost to screen readers.
   - Fix: pass `emptyLabel={block.alt || undefined}`.

4. **Low: `src/components/store/photo.tsx:25`. The related-card placeholder can change the card height.**
   - The placeholder drops `className="store-photo"` and the 400/500 size attributes.
   - Cards whose image failed can therefore have a different height from the others.
   - Fix: give `.store-photo-empty` the same aspect ratio as the photo (tokens and logical props only).

5. **Low: `product-view.tsx:62-75`. Broken gallery images each become a placeholder slide.**
   - With several broken images, the shopper swipes through identical "no photo" slides, mixed in with the real photos.
   - Fix (optional, outside DoD 9): hide the failed slides, and show one placeholder only when every image has failed.

6. **Low: `src/components/document-title.tsx:12`. The path is captured once per `[title]` effect.**
   - Take a client navigation from one not-found URL to another.
   - If React keeps the same instance, the guard can stop re-applying the title.
   - Fix: add `usePathname()` to the effect's dependencies instead of reading `location.pathname`.

7. **Low: `page-editor.tsx:267`. The published hint reads as an error.**
   - While the page is published, the hint reuses `errNeedsProduct`.
   - Fix: add a dedicated "unpublish to change the product" key in both `en.json` and `ar.json`.

8. **Low: `src/lib/store/stores.rls.test.ts:557-558`. The ws2 insert checks are too loose.**
   - They assert only `error !== null`, so any constraint error would pass them.
   - Fix:
     - assert `error.code === "42501"`;
     - use `svc` to check that `pageB` still exists and its title is unchanged.

## Missing tests
- **DoD 6:** no test that a publish UPDATE matching zero rows returns `needs_product`. The `actions.test.ts` mock always returns `[{id:"x"}]` for an update (line ~26). Make that result configurable, the way `deleteResult` is.
- **DoD 7:** no tests at all. Missing:
  - a publish read error throws;
  - an `assertPublishable` read error throws, from both `publishPage` and `linkPageProduct`;
  - preview throws on a page, store or product read error;
  - preview's unknown id still calls `notFound()`.
- **DoD 4:** the link guard is tested only with `status: "published"`. Add the draft case.
- **DoD 10:** the contrast of the hint (at least 4.5:1, AR dark and light) is not measured. Record the measured ratio.
