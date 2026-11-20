# STORE-2-H brief
risk: low · surface: ui,security · lane: store

Source: `docs/briefs/STORE-2-G.review-2.md` lows 1-6 and `.review-1.md` lows 4-8 (the rest of review-1 was fixed in G).
No migration, no new dependency, no DB or DTO change. No new DECISIONS row needed.

## Goal
Close the open lows of STORE-2-G without changing behaviour elsewhere.

## Definition of done
1. `StorePhoto` skips the mount check when `loading="lazy"` (onError still swaps the placeholder).
2. `DocumentTitle` re-runs on path change (`usePathname()` in deps; drop the closed-over `location.pathname`).
3. `linkPageProduct` throws on `pageError`; `fail("failed")` only for a missing row.
4. Published-page Unlink hint uses its own key (en+ar), not `errNeedsProduct`.
5. ws2 insert checks assert `error.code === "42501"`; `svc` shows pageB title unchanged.
6. A related-card placeholder keeps the card height (4/5 aspect, already in `.store-photo-empty`), shown in a screenshot.
7. Broken gallery images collapse: failed slides hidden, ONE placeholder only when all failed.
8. `.store-top` conflict noted, not fixed (see edge cases).
9. Missing tests from G review-2 added (below). Gate OK.

## Files and change
- `src/components/store/photo.tsx`: guard `if (img.loading !== "lazy" && imageFailed(...))`; add optional `onFail?: () => void` prop called when failed (for item 7).
- `src/components/store/product-view.tsx` (gallery, lines ~56-75): extract a small client `Gallery` (new `gallery.tsx`) holding a `Set` of failed indexes; renders only non-failed `StorePhoto`s; when all failed render one `.store-photo-empty` with `noPhoto`. Keep `fetchPriority`/lazy attrs. The slot count must still render >=1 element.
- `src/components/document-title.tsx`: `const pathname = usePathname()`; effect deps `[title, pathname]`; compare against `pathname`-time `location.pathname`.
- `src/app/(app)/app/store/actions.ts:131`: `if (pageError) throw new Error(\`linkPageProduct: ${pageError.message}\`); if (!page) return fail("failed");`
- `src/app/(app)/app/store/_components/page-editor.tsx:267`: new key `store.pages.unlinkLocked` (use the same namespace as `errNeedsProduct`, en.json ~1598 and ar.json ~1598): EN "Unpublish the page to change its product." AR equivalent. Colors via tokens only; check contrast >= 4.5:1 AR dark+light.
- `src/lib/store/stores.rls.test.ts:144-145`: assert `code` "42501" (live suite, run it); add `svc` check of pageB.
- `src/components/store/store.css`: no change unless the gallery needs a rule for the single placeholder (tokens, logical props).

## Steps (commit each)
1. photo.tsx lazy guard + test. 2. document-title + test. 3. linkPageProduct throw + tests. 4. hint key en/ar + editor. 5. RLS test asserts. 6. Gallery collapse + related placeholder + tests. 7. Missing tests + screenshots + PROGRESS.

## Acceptance tests
- `photo.test.tsx`: lazy image with complete=false never flips to placeholder; eager failed image does.
- `photo.ssr.test.tsx` / new `gallery.test.tsx`: some failed -> failed slides hidden; all failed -> exactly one placeholder; none failed -> all.
- `actions.test.ts`: make `updateResult` configurable (like `deleteResult`) and test publish with zero rows -> `needs_product` (DoD6 of G); publish read error throws; `assertPublishable` read error throws from publishPage and linkPageProduct; `linkPageProduct` page read error throws; link guard with a `draft` page.
- Preview (`pages/[id]/preview/page.tsx`): test throws on store_pages/stores/products read error; unknown id -> `notFound()`.
- document-title test: path change re-applies title.
- RLS live: 42501 asserts (run `stores.rls.test.ts` against local stack).

## Screenshots (browser MCP; say so if absent)
Store page `/s/luxe/<slug>` AR (store is Arabic only, D79f) 390+1280, light+dark: (a) one broken image not first, (b) all broken, (c) related card with broken image next to a working card. Editor with published page + hint, AR dark+light. Name `docs/design/audit/STORE-2-H/<screen>-<lang>-<theme>-<width>.png`; check `<html>` class/lang. Needs local demo page from D79(b) (local DB only).

## Edge cases / assumptions
- All G files exist as cited, except editor path is `_components/page-editor.tsx` (review said `pages/[id]/`); line numbers shifted slightly (ws2 inserts at 144-145).
- Gallery hiding must not break scroll-snap or `key={src}`; a failed first image loses `fetchPriority` benefit, fine.
- Hiding failed slides changes the alt index "n of total": keep original index/total.
- `.store-top` (store.css:46): STORE-3 (blocked, unmerged) edits the same line; do NOT touch it here, expect a conflict at STORE-3 merge, mention in PROGRESS.
- Security: no new surface; actions keep `requireAdminProfile` + workspace filter. Throwing replaces silent `fail` only on read errors.
