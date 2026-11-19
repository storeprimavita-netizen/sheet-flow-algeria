VERDICT: ESCALATE

## Summary
Reviewed `git diff v3...v3-STORE-2-F` with qa-reviewer (OWASP) and ui-reviewer (chrome-devtools, local stack). No reachable security issue was found. Review-1 #2, #5 and #6 are resolved.
One DoD item conflicts with how the framework works. A 404 status and a server-rendered `<h1>` cannot both come from `notFound()` thrown in the layout, so the owner (or /decide) must choose. Review-1 #1, #4 and #7 are still open.
The fixable items below (#2 to #8) must land in the same pass.

## Findings (ranked)

1. **MEDIUM, needs a decision.** `src/app/(store)/s/[store]/[slug]/layout.tsx:15`: the unknown-store 404 has no `<h1>` in the initial HTML.
   - Failure: `curl /s/nope/xx` and `curl /s/luxe/definitely-missing` return status 404 with `<html id="__next_error__">` and no `<h1>` or `<main>`. The h1 renders only after hydration.
   - Cause: `next/dist/server/app-render/app-render.js:1089-1130` (`getErrorRSCPayload`) emits an empty error shell when `notFound()` escapes the shell. The guard was put in the layout on purpose, to get a real 404 instead of a 200 streamed behind `loading.tsx`.
   - Moving the guard into `page.tsx` with `[slug]/not-found.tsx` restores the h1 but loses the 404 status. The brief marks the status as informational but makes the h1 part of the DoD.
   - Options:
     - (a) Amend the DoD in DECISIONS to accept the status-404 empty shell.
     - (b) Move the guard into `page.tsx` and accept a 200 plus noindex.
     - (c) Rewrite in the proxy to a static 404 page with status 404, at the cost of one slug lookup per request.
   - Whichever is chosen, add an HTTP test that asserts the chosen behaviour.

2. **MEDIUM.** `src/app/(app)/app/not-found.tsx:9-12`: the `<title>` does not apply in the browser (review-1 #7).
   - Failure: as admin in AR at `/app/store/pages/00000000-0000-0000-0000-000000000000`, `document.title` is "MNW ERP" instead of "الصفحة غير موجودة". Next 16 does not apply `generateMetadata` from a segment `not-found`.
   - The unit test passes only because it calls the function directly.
   - Also: `/app/zzz` falls through to the global 404 (title "404"), so the role-home CTA never shows for unmatched app routes.
   - Fix: render a `<title>` element inside the not-found component (React 19 hoists it). Add an `app/[...rest]/page.tsx` catch-all that calls `notFound()` so unmatched routes reach the app not-found. Test with a real HTML/title assertion.

3. **MEDIUM.** The public page at 1280 px is unbalanced. `src/components/store/store.css` has no diff on this branch, although the DoD lists it.
   - Failure: on `/s/luxe/abaya-fresh` the gallery column is about 810 px wide with a placeholder about 1010 px tall. The info column is narrow with empty space under it, and the order form is not visible at first view.
   - The screenshot (`docs/design/audit/STORE-2-F/rev-store-1280.png`) also shows the dark theme. The store default is light (review-1 #8), so confirm whether the OS caused it.
   - Fix: cap the gallery with `aspect-ratio` and a max block size, and rebalance the grid columns. Make sure the form, or a clear sold-out state, is reachable at 1280 px and 390 px.

4. **MEDIUM.** Required screenshots are still missing (review-1 #4).
   - Only `store-404-1280.png` is committed. `.next/shots/` does not exist.
   - Missing: AR editor (`page-editor.tsx` RTL alignment is unverified visually), hub error state, agent not-found, app not-found in dark mode and in EN, and `/s/luxe/<slug>` at 1280 px and 390 px.
   - Fix: capture each one, fix what they show, and note it in PROGRESS.md.

5. **LOW.** `src/app/(app)/app/store/actions.ts:162-167`: publish race.
   - Failure: `setPublished` checks the product, then runs an UPDATE without `.eq("product_id", pg.product_id)`. If a concurrent `linkPageProduct` swaps the draft to an inactive product in between, the page goes live and answers 404.
   - Fix: add the product_id guard to the update, and add a test.

6. **LOW.** `actions.ts:148`: `assertPublishable` ignores a read error and returns `needs_product`. It fails closed but with a misleading message.
   - Fix: return `failed` on error.

7. **LOW.** `src/lib/store/store-http.test.ts:536,544`: weak assertions.
   - The "real page" case silently falls back to an all-zero UUID when the admin has no pages.
   - The "no store data" check only matches the `>Store<` h1, so it depends on the locale.
   - Fix: require a real page id, and assert that the page title, store slug and store name are absent.

8. **LOW.** The sidebar keeps "صفحات المنتجات" highlighted on the app 404.

## Missing tests
- An HTTP assertion for the store 404, matching the decision in #1.
- A real `<title>` check for the app not-found page, and `getProfile()` returning null in the not-found render.
- `createStore` when the `existing` read (`:38`) or the race read (`:48`) fails. Today the mock's `readError` only reaches `maybeSingle`.
- The `setPublished` / `linkPageProduct` race (#5).
- `liveStoreSlugs` pagination: look up a slug that exists only on page 2.
- Confirm the gate runs the opt-in agent HTTP test and the cross-workspace RLS test, or document that they run only on the live stack.
