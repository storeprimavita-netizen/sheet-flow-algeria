VERDICT: FIX

## Summary
Diff round 1 (`git diff v3...v3-STORE-2`). Reviewers: qa-reviewer (owasp-security) + ui-reviewer (browser MCP, localhost:3001).
Security core is sound: gate green with the live RLS suite (D24 met, 502 pass); no anon grants; composite FKs block cross-workspace links; DTO is cost-free, published-only, explicit columns; every publish path in the product and store actions calls `updateTag`; proxy skips only `/s`.
Two medium bugs block PASS: DB errors are cached as 404s on the public page, and the editor has a hydration mismatch.
The UI review did not cover the app in AR/RTL, the app in dark, the app states, or the store at 1280 px. That coverage is required next round.

## Findings (ranked)

1. **MEDIUM: a DB error is cached as "not found"** (`src/lib/store/data.ts:44,52,62,136,146` and `loadVariants` at `:115-120`)
   - Problem: every Supabase call reads `data` and ignores `error`.
   - Effect: a short PostgREST or DB failure returns `null`. `unstable_cache` and ISR then cache that result, so a live product answers 404 for at least 120 s, until the next `updateTag`.
   - Variants: if only the variants queries fail, the page is cached with `variants: []`, so every size disappears.
   - Fix: `throw` when any query returns `error`. A thrown error is not cached, `error.tsx` shows its retry button, and ISR keeps the last good page.
   - Test: a mocked DB error must not produce a cached null.

2. **MEDIUM: hydration mismatch in the page editor** (`src/app/(app)/app/store/_components/page-editor.tsx:28-29,42,44`)
   - Problem: `rid = crypto.randomUUID()` runs inside the `useState` initializers, so server and client render different row ids.
   - Effect: the ids feed the Up/Down button ids and the field ids. React logs a hydration error and the Next dev overlay shows "1 Issue". The field label/id links can break after hydration.
   - Fix: build ids that are the same on server and client (index plus type, or a counter), or assign ids after mount.

3. **LOW: stock changed by order status is not invalidated** (`orders/actions.ts` transition/swap, ZR webhook)
   - Problem: these paths rely only on `revalidate 120`. Because ISR serves the stale page first, a low-traffic page can show "in stock" well past 120 s.
   - Fix: call `revalidateTag('store-public','max')` in those paths. In the webhook route handler, `updateTag` cannot be used.

4. **LOW: random slugs cause unbounded cache writes** (`data.ts:162-171`, `s/[store]/[slug]/page.tsx:11`)
   - Problem: every new well-formed URL costs one service-role query plus a data-cache entry and an ISR 404 entry.
   - Fix: return 404 early for unknown stores, using a tag-cached set of live store slugs and no per-page cache entry for them.

5. **LOW: Publish is enabled when the page can never render** (`page-editor.tsx:123`)
   - Problem: Publish stays enabled when the linked product is inactive or has no `sale_price`. The page publishes and then answers 404 with no warning.
   - Fix: disable Publish and give the reason.

6. **LOW: wrong error message for a duplicate product** (`src/app/(app)/app/store/actions.ts:15`)
   - Problem: `dbFail` reports a violation of `unique(store_id, product_id)` as `slug_taken`.
   - Fix: return a distinct "product already has a page" error.

7. **LOW: `createStore` can create two stores** (`actions.ts:36-44`)
   - Problem: the existing-store check and the insert are separate steps, so two quick requests can create two stores. The UI shows only the oldest one.
   - Fix: add a DB constraint, or handle the conflict on insert.

8. **LOW: related products are in the wrong order** (`data.ts:154`)
   - Problem: related pages come back in DB order rather than block order, and a page can list itself.
   - Fix: keep the block order and drop the page's own id.

9. **LOW: plural bug on the Store overview** (`src/app/(app)/app/store/page.tsx`)
   - Problem: the overview reads "0 published, 1 drafts".
   - Fix: ICU plurals in en.json and ar.json.

10. **LOW: the "Store settings" nav item looks disabled** (`src/components/nav-model.tsx`)
    - Problem: its computed colour is about L37, much dimmer than its sibling items, in both the inactive and active states.
    - Fix: check the contrast and the active styling.

11. **LOW: unpublish uses a native confirm, and a field has no label** (`page-editor.tsx:102`)
    - The unpublish confirmation is a native `window.confirm`. Use the app's Radix dialog.
    - The console also reports "No label associated with a form field", probably the Combobox trigger.

## Missing tests
- Cache behaviour, through `unstable_cache` and ISR rather than calling `loadPublicProductPage` directly:
  - `publish after cached 404 shows page`
  - `slug rename old url 404`
  - `price/name/is_active change shows`
- `variant stock change shows` is absent.
- The HTTP suite (`store-http.test.ts`) never runs in the gate, because it needs `STORE_E2E_URL`. Its tests:
  - `s response no Set-Cookie, /app still redirects`
  - the locale cookie check
  - `?preview=1` draft returns 404
- Missing build checks:
  - a smoke test of each root layout
  - `<html>`, fonts and Toaster identical for `/login` and `/app/dashboard` in AR and EN
- `workspace B admin cannot read A` covers `stores` only. Add `store_pages`.
- No test that a DB error is not cached (finding 1).

## Missing UI coverage (required next round)
- App screens in AR/RTL and in the dark theme.
- App states: skeletons, error with retry, and the empty states (no store, no pages).
- Store page at 1280 px, and its `loading.tsx` and `error.tsx` states.
- Long Arabic name, one size, and no announcement.
- The unpublish confirm flow and the dirty indicator.
- Keyboard and focus order.
- Store contrast ratios.
- How out-of-stock sizes are labelled (all size chips render struck through).

Screenshots from this round: `docs/design/audit/STORE-2/`.
