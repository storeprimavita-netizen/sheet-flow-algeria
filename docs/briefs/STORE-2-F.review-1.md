VERDICT: FIX

## Summary
Data errors now throw, `liveStoreSlugs` is paginated, the `createStore` loser's delete is checked, and the role-home not-found works.
Not done: the store 404 still has no `<h1>` in its initial HTML. That is a DoD item.
The `linkPageProduct` guard lets the link through when its page read fails.
Two named live tests are missing (cross-workspace RLS, agent-session HTTP), the pagination test is weak, and the required screenshots were never taken.
Reviewers: qa-reviewer (owasp) + ui-reviewer.

## Findings (ranked)

1. **MEDIUM: the DoD item "Unknown-store 404 has `<h1>` in initial HTML" is not met.**
   - Where: `src/app/(store)/s/[store]/[slug]/layout.tsx:15` and `src/app/(store)/s/not-found.tsx:7-12`.
   - Failure: `curl localhost:3000/s/nope/xx` returns 404 with `<html id="__next_error__">` and no `<h1>` or `<main>`. The text only arrives in the RSC payload after hydration, so a JS-less in-app browser or a crawler gets an empty page. PROGRESS records the same on `next start`.
   - Cause: `notFound()` is thrown from the layout, and its boundary falls through to the root error shell.
   - Fix: resolve the store and page in `page.tsx`, or add a `not-found.tsx` at `[store]/[slug]` level with a non-throwing layout, so the not-found renders server-side. Re-check with curl on `next start`.

2. **MEDIUM (security, fail-open): the `linkPageProduct` publish guard is skipped on a read error.**
   - Where: `src/app/(app)/app/store/actions.ts:128`.
   - Failure: the `store_pages` status read ignores `error`, and also ignores the case where `page` is null. If that read fails, `page?.status` is undefined, `assertPublishable` is never called, and a published page gets linked to an inactive or priceless product. The public page then serves an unorderable product.
   - TOCTOU: a page that is a draft at read time can be published by a parallel request before the update.
   - Fix: return `dbFail(error)` or `fail("failed")` when there is an error or `!page`. Add `.eq("status", page.status)` to the update so a concurrent publish matches 0 rows and the action returns `failed`.

3. **MEDIUM: named tests from the brief are missing.**
   - Missing: `stores.rls.test.ts` "store_pages cross-workspace: agent/admin of ws2 cannot read, insert with ws1 store_id, or relink product of ws1". The DB constraints do hold (checked by hand with SQL), but the test must exist with real sessions.
   - Missing: the agent-session HTTP test for `/app/store` and `/app/store/pages/<id>`.
   - Not done: the one-off `store-http.test.ts` run against `next start`, with its result noted in PROGRESS.

4. **MEDIUM: the required screenshots are missing (UI task end condition).**
   - None of the screenshots the brief lists exist: app not-found (admin and agent), hub error state, AR page editor, `/s/luxe/<slug>` at 1280 px and 390 px, in dark and light and in AR and EN.
   - The AR editor fix is a single `text-start` on the root (`page-editor.tsx:197`). It is unverified visually, and the editor still needs a grep for `text-left`, `ml-`, `pl-`, `left-`, `right-`.
   - `store.css` is unchanged. `.store-wrap` measures 1120 px at 1280 px, but the hero, gallery and form columns were not checked.

5. **LOW: `createStore` ignores read errors.**
   - Where: `actions.ts:38` and `:46`.
   - Failure: if the `all` read fails, the action returns `ok` and skips the race check.
   - Fix: check `error` on both reads and return `failed`. The deeper race (`created_at` is the transaction start time) is accepted by the brief: no unique index without a DECISIONS row.

6. **LOW: the editor page turns a DB error into a 404.**
   - Where: `src/app/(app)/app/store/pages/[id]/page.tsx:19-27`.
   - Failure: a failed page read shows not-found instead of the error state. A failed products read leaves the product picker empty.
   - Fix: throw on `error`, as `getStore` now does.

7. **LOW: the app not-found `<title>` is unverified.**
   - Where: `src/app/(app)/app/not-found.tsx:10`.
   - Detail: the test only calls `generateMetadata()` directly. Next 16 documents metadata for `global-not-found`, but not for a segment `not-found`.
   - Fix: confirm the real `<title>` with curl as a logged-in agent.
   - Separate gap: `/s/nope`, with no slug, falls to the English-only `global-not-found`. That is informational.

8. **LOW: the store 404 renders dark under OS dark mode.** The store skill says light is the default. Confirm this is intended.

## Missing / weak tests
- `data-errors.test.ts`: the pagination test only asserts the range offsets. It looks up `s1004`, which is not on page 2 (`rows(5)` gives S0 to S4), so a regression to keeping only the last page would still pass. Look up a slug that exists only on page 2.
- `data-cache.test.ts`: it clears the memo map by hand. Assert instead that the cache tags include `"store-public"`.
- The two renamed `data.test.ts` tests are `skipIf(!URL)`. Confirm the gate runs them against the local DB.
- No test for `linkPageProduct` when the page read fails, or for a concurrent publish.
- No test for `getProfile()` returning null in `not-found.test.tsx`.
- No curl/HTTP assertion for the store 404 `<h1>`.
