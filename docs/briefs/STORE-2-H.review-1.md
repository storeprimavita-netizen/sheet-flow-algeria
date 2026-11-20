VERDICT: PASS

## Summary
Diff `v3...v3-STORE-2-H` reviewed by qa-reviewer (owasp-security) and ui-reviewer. DoD 1-8 met in code. The live RLS suite was run against the local stack: 8/8 pass, including the new 42501 asserts. The store, document-title and app/store unit suites pass.
The ui-reviewer's "missing actions tests" medium was checked and is false: configurable `updateResult`, publish with zero rows, read errors and the draft link guard are already on v3 (`actions.test.ts:105-124`). The two other ui mediums are trade-offs the brief accepted, or already covered, so they are downgraded to low.
No new attack surface: `requireAdminProfile` and the workspace filter are unchanged, and `Gallery` gets only `name` and `images` (no cost fields).

## Findings (all low)
1. **low**: `src/app/(app)/app/store/_components/page-editor.tsx:144-149` with `actions.ts:131`
   - Failure: `linkPageProduct` now throws on a read error, and `link()` has no try/catch inside the transition. A transient PostgREST error goes to the `app/store/error.tsx` boundary, and unsaved title, slug, blocks and SEO are lost. `togglePublish` already behaves this way.
   - Fix: try/catch in `link()` and `togglePublish`, then call `setError(t("errFailed"))`.
2. **low**: `src/components/store/photo.tsx:30`
   - Failure: lazy images skip the mount check. A lazy image that errors before hydration (slides 2+ near the viewport, related cards) stays as a broken icon and its gallery slot never collapses. The brief accepted this.
   - Fix (optional): also flip when `img.complete && img.naturalWidth === 0 && img.currentSrc !== ""`.
3. **low**: `src/lib/store/stores.rls.test.ts:144-145`
   - Failure: the `adminB` cross-workspace `store_pages` inserts still assert only `error !== null`, so any constraint error (NOT NULL, slug clash, FK) passes. The `agent2` block was tightened instead. The update/delete checks at 164-166 use `data ?? []`, so an error also counts as "denied".
   - Fix: assert the exact code (42501, or the trigger's code) at 144-145, and assert `error` is null or 42501 on the update/delete checks.
4. **low**: `src/components/store/gallery.tsx:10`
   - Failure: the failed set is keyed by index while the React keys use `src`. If `images` changes without a remount, the stale indexes hide the wrong photos.
   - Fix: store failed `src` values, or key `Gallery` on `images.join()`.
5. **low**: `src/components/document-title.tsx:14`
   - Failure: `location.pathname !== pathname` can disagree under a basePath or i18n rewrite, and the title would then never apply. No such setup exists today.
   - Fix: add a comment, or drop the comparison.
6. **low**: screenshots in `docs/design/audit/STORE-2-H/`
   - The related-card placeholder (DoD 6) appears only inside `gallery-one-broken-*`, where it shows the correct height. There is no separate `related-broken-*` shot, no 390 px editor shot, and no measured contrast for the `unlinkLocked` hint in AR dark and light.
   - Fix: add those shots and measure the hint contrast.

## Missing tests
- `gallery.test.tsx` and `document-title.test.ts` stub `useState` and `useEffect`. Add one DOM-level test of the real hide-on-error flow.
- `photo.test.tsx`: a mount-check failure on an eager image calls `onFail` (only the `onError` path is checked today).
- Gallery: duplicate `src` values, and a changed `images` prop with a stale failed set.
- Preview: a page with a null `product_id` calls `notFound()`; a non-admin is stopped by `requireStoreAdmin` before any read.
- Editor: a rejected `linkPageProduct` or `publishPage` shows an error and keeps unsaved state (after finding 1).
- RLS: exact error codes for the `adminB` inserts at 144-145.
