VERDICT: ESCALATE

## Summary
Reviewed `git diff v3...v3-STORE-2-F` with qa-reviewer (OWASP) and ui-reviewer (chrome-devtools, local stack). Gate OK (815 passed, 5 skipped; the skips are the opt-in `store-http.test.ts`). No high finding, no reachable leak or authz gap.
Review-2 #1 (D76), #2 (app not-found title + catch-all) are resolved. The rule escalates this review: it is round 3 with no PASS, and three medium findings remain.
Under D40: gate OK and no high finding means the task merges and the open findings below go into a follow-up row. `/decide` confirms this.

## Findings (ranked)

1. **MEDIUM.** `src/lib/store/store-http.test.ts:80`: the agent HTTP test the brief names can never pass.
   - Failure: `expect(html).not.toContain(pageId)` fails on both `next start` and `next dev`. Next puts the route params into the RSC payload (`"c":["","app","store","pages","<id>"]`).
   - Nothing leaks: the page title and slug are absent. The gate skips this file, so the failure is hidden.
   - Fix: assert that the page's `title` and `slug`, read through the admin client, are absent. Do not assert on the id.

2. **MEDIUM.** `/s/luxe/abaya-fresh`, from `src/components/store/store.css` (around lines 43-47) and the product page component: a sold-out product is a dead end.
   - Failure: the only size, M, is struck through and labelled "غير متوفر". The page shows no sold-out message, no form and no call to action.
   - At 1280 px the info column sits against the gallery and leaves the rest of the viewport empty. The DoD asks for "form or clear sold-out state reachable at 1280/390".
   - Fix: when no size is available, render a page-level sold-out block with a way back or a way to ask for it. Rebalance the grid columns at 1280 px.

3. **MEDIUM.** The screenshots in `docs/design/audit/STORE-2-F/store-page-{390,1280}.png` show a broken image.
   - Failure: the seed image src is `https://x.com/a.jpg` (naturalWidth 0), so the alt text "صورة 1 من 1" shows in the tile. The shots do not show a working gallery.
   - These screenshots are still missing:
     - store hub error state
     - agent not-found
     - app not-found in AR light and at 390 px
     - store page in EN, and dark at 390 px
   - Fix: use a local seed image, or fall back to the empty-photo placeholder when the image fails to load. Then re-shoot the full set from the brief.

4. **LOW.** `src/app/(app)/app/store/_lib/data.ts:22`: `getStore` orders by `created_at` only. The brief requires the `(created_at, id)` tie-break. Add `.order("id")`.

5. **LOW.** `src/app/(app)/app/store/actions.ts:47-54`: `createStore` can still end with two stores.
   - Failure: `created_at = now()` is the transaction start time. If A starts first but commits after B has listed the stores, both requests win.
   - A clean fix needs an advisory-lock RPC, which means a migration and a DECISIONS row (see the brief's edge cases).

6. **LOW.** `actions.ts:159-166`: publish race (open since review-2 #5).
   - Failure: `setPublished` runs its UPDATE without `.eq("product_id", pg.product_id)`. A concurrent relink can publish a page with an inactive product, which then answers 404.
   - Fix: add the filter and a test.

7. **LOW.** `actions.ts:148`, `actions.ts:159` and `pages/[id]/preview/page.tsx:24-30`: a DB error is reported as the wrong thing.
   - `assertPublishable` and the publish read ignore `error`, so a DB failure shows as `needs_product`.
   - The preview page turns a DB error into a 404 instead of the error state.

8. **LOW.** `src/components/document-title.tsx:10-16`: the observer may write "Page not found" over the next page's title after the user clicks Back. Not confirmed in a browser. Fix: use a mounted ref or an `isConnected` guard inside `apply`.

9. **LOW.** `store-http.test.ts:34`: the "no store data" check is weak.
   - It looks for `/luxe modesty/i`, but the seed store is named "Luxe".
   - It checks no product title, which D76(2) requires.

10. **LOW, UI.** The "Product pages" item in the sidebar looks dimmed, as if disabled. The "إلغاء الربط" link in the AR dark editor has low contrast. The AR search chip shows "K⌘" without LTR isolation; this one predates the diff.

## Missing tests
- `data-cache.test.ts:43` fakes the cache bust with `memo.clear()`. No test checks that `invalidateStorePublic` calls `updateTag("store-public")`.
- No test that the hub and the pages list throw when the `store_pages` or products query errors. No test that error.tsx shows a reason and a retry.
- `stores.rls.test.ts` covers only the ws2 admin. The brief also names the ws2 agent.
- The `actions.test.ts` mock ignores `.eq()`, so the status guard against a change between read and write is untested.
- No test for the `[...rest]` catch-all route.
