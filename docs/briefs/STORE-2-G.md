risk: low · surface: ui,security · lane: store
(No migration, no RLS change, no new decision. Security surface = public store page + admin actions; qa-reviewer optional, ui-reviewer required.)

Goal: close the low findings of STORE-2-F review-3 (5-10) and review-4 that D79(g) deferred, plus EN/placeholder UI polish.
Out of scope: store 404 `<h1>` (D78), sold-out block (STORE-3, D79), advisory-lock `createStore` race (needs migration + DECISIONS row: log it, do not build), DB trigger for deactivated linked product (same).

## Definition of done
1. `invalidateStorePublic` has a test asserting `updateTag("store-public")` is called.
2. Hub and pages list throw on a `store_pages`/products error (test); `error.tsx` renders reason + retry (render test).
3. `stores.rls.test.ts` covers a ws2 agent (cannot read/write stores or store_pages of ws1 or ws2).
4. `actions.test.ts` mock records `.eq()` calls; a test proves `linkPageProduct` writes with `.eq("status", page.status)` and `setPublished` with `.eq("product_id", ...)`.
5. A test for the `src/app/(app)/app/[...rest]/page.tsx` catch-all (calls notFound) and for the not-found CTA href per role.
6. `setPublished` publish UPDATE has `.eq("product_id", pg.product_id)`; zero rows -> `fail("needs_product")`.
7. `assertPublishable`/publish read and `preview/page.tsx` surface DB `error` (throw to error state) instead of `needs_product`/404. Unknown-id still 404.
8. `DocumentTitle` cannot overwrite the next page's title (mounted ref + `isConnected`/pathname guard in `apply`).
9. A store photo that fails to load shows the `store-photo-empty` placeholder (gallery + related cards).
10. Editor Unlink: already `disabled` when published (page-editor.tsx:263); make it hidden while published, keep the hint, text contrast >= 4.5:1 in AR dark/light.
11. Sidebar "Store settings" (`nav-model.tsx:90`, key `storeSettings`) no longer reads as disabled in either theme.
12. At 1280 px, `.store-buy` is not stranded: with `#order` hidden, no big empty block under sizes (align column to start, gallery height does not stretch the grid row).
13. Screenshots in EN + AR, light + dark, 390 + 1280 (see below). Gate passes.

## Files and change
- `src/lib/store/data-cache.test.ts` (or new `invalidate.test.ts`): mock `next/cache`, call `invalidateStorePublic`, assert `updateTag` arg. (DoD 1)
- `src/app/(app)/app/store/{page.tsx,pages/page.tsx,_lib/data.ts}`: check query `error` on store_pages/products and throw; add tests next to `data-errors.test.ts` (exists in src/lib/store) or `_lib`. `error.tsx` render test.
- `src/lib/store/stores.rls.test.ts`: add ws2 agent session using the existing helpers (lines ~33-71).
- `src/app/(app)/app/store/actions.ts`: lines ~136-166 as DoD 6-7; `actions.test.ts` mock upgrade.
- `src/app/(app)/app/store/pages/[id]/preview/page.tsx:24-30`: throw on `error`, 404 only when no row.
- `src/components/document-title.tsx`: guard.
- `src/components/store/product-view.tsx` lines 19, 63, 121: replace bare `<img>` with a small client `StorePhoto` (`store/photo.tsx`, `onError` -> placeholder; keep `fetchPriority`/lazy/width/height; handle error that fired before hydration via `ref.complete && naturalWidth===0` in an effect). Native attrs stay; consult `modern-web-guidance` (images).
- `src/components/store/store.css` lines 42-47: `.store-top { align-items: start }` at >=860px; gallery keeps its max height. Logical props only; tokens only.
- `page-editor.tsx:263-267`, `nav-model.tsx` + nav item styling: find why the item is dimmed (check sidebar CSS for `storeSettings` / SlidersHorizontal, muted token), fix with tokens.
- `src/messages/{en,ar}.json`: any new key in both (gate parity).

## Steps (commit each with scripts/step.sh)
1 tests only: DoD 1-5 (they pass against current code except where noted) 2 actions fixes + tests (6-7) 3 DocumentTitle (8) 4 StorePhoto (9) 5 CSS layout (12) 6 editor/nav (10-11) 7 screenshots + PROGRESS note.

## Acceptance tests (names)
`invalidateStorePublic busts store-public`, `hub throws on store_pages error`, `error.tsx shows reason and retry`, `agent of ws2 cannot see or write stores`, `publish filters on product_id`, `link guard filters on status`, `catch-all route calls notFound`, `DocumentTitle does not overwrite after unmount`, `StorePhoto shows placeholder on error`.

## Screens to screenshot (browser MCP, save in docs/design/audit/STORE-2-G/)
Store product page `/s/luxe/<slug>` with a broken image AND a real local image: EN+AR, light+dark, 390+1280. Editor page (published, AR dark). Sidebar store group (AR + EN, both themes). Hub error state EN. Agent not-found EN.

## Edge cases / assumptions
- Review-3 lows 4 (order by id) and 1-3 are already fixed (getStore has `.order("id")`); review-3 low 9 (store-http "no store data") may remain weak: seed store is "Luxe", test greps `luxe modesty`: change to `/luxe/i` on the store name only if the 404 html cannot contain "luxe" otherwise (path /s/nope is fine; verify).
- Seed image `https://x.com/a.jpg` in dev data is why shots were broken; use a local file under public/ for the "working" shot, do not commit seed data changes.
- No new DECISIONS row needed. Anything beyond the list: log in PROGRESS, do not expand.
