VERDICT: FIX

## Summary
Round 2 of the diff (`git diff v3...v3-STORE-2`, HEAD 883e523). Reviewers: qa-reviewer (risk high, security) and ui-reviewer (ran the app with the browser MCP on the dev server; screenshots in `docs/design/audit/STORE-2/round3/`).
Gate in review: GATE OK — tsc, 503 passed / 3 skipped with the live RLS suite, i18n, color lint, build, protected paths, secret scan.
No high findings. Three medium findings and one medium missing test block a PASS. No finding needs an owner decision.

Review-2 items: #1 (DB error cached as 404) fixed — every query in `src/lib/store/data.ts` throws and a thrown error is not cached. #2 (editor hydration) fixed — no hydration or error entries in the console on fresh loads, EN and AR. #5, #6, #8, #9, #11 fixed. #3, #4, #7 partly fixed (findings 5, 6 below; #4 leaves one ISR 404 entry per random URL, accepted).

## Findings

### 1. Medium: every size shows sold out on products not yet counted per size (breaks D54.4)
- **Where:** `src/lib/store/data.ts:134` (`inStock: v.stock > 0`).
- **Failure:** D54.4 says a size is out only when its own count plus the product's "not assigned" pieces (`products.stock − Σ variant.stock`) are used up. On the local DB, Abaya Noor, Ensemble Lina, Veste Sarah, Robe Zahra and Jupe Amel each have 142–145 pieces, all not assigned, every variant at 0 — every size chip on their public pages renders `data-out="true"`. After the production migration this is every product.
- **Fix:** select `products.stock` plus the stock of all variants; `inStock = v.stock + (product.stock − Σ variants) > 0`. Return only the boolean.
- **Test (medium, ships with the fix):** "variant stock change shows", including the uncounted case.

### 2. Medium: an agent can load the Store admin pages' data — the guard is in the layout only
- **Where:** `src/app/(app)/app/store/layout.tsx:6-8` (`notFound()`), pages and `_lib/data.ts`.
- **Failure:** signed in as `confirmation@seed.mnw`, `/app/store` shows a 404 and the nav group is hidden, but `fetch('/app/store')` and `fetch('/app/store/settings')` return HTTP 200 and the RSC payload contains the store `id`, `name`, `slug`, `status` and `settings` JSON. Pages render in parallel with the layout and still stream their data. RLS lets agents read `stores` (by the brief) and `store_pages` stays admin-only, so the wall holds; the page guard does not.
- **Fix:** check the admin role in every store `page.tsx` or inside `getStore()` and the other data helpers. Add a guard test with an agent session.

### 3. Medium: dead-end 404 inside the app
- **Where:** `/app/store/pages/not-a-uuid`, and the agent 404 on `/app/store` (`admin-404-bad-id.png`).
- **Failure:** Next's bare English "404 This page could not be found": no app shell, no link back, no Arabic.
- **Fix:** `not-found.tsx` under `app/store` (ideally under `/app`) using `Empty` plus a link to the Store hub, EN + AR.

### 4. Low: some stock-moving paths do not mark the store stale
- **Where:** `orders/actions.ts` — `changeOrderVariant` (~l.430, moves a hold between sizes, D54.6), `updateConfirmationStatus` (form path), `createOrder`, `refreshZRShipmentStatus`.
- **Fix:** call `markStorePublicStale()` in each (the 120 s revalidate limits the staleness today).

### 5. Low: the `createStore` race fix can still leave two stores
- **Where:** `store/actions.ts:44-49`.
- **Failure:** `created_at` is the transaction start, not the commit; two overlapping requests can each see only themselves. The `delete` result is ignored.
- **Fix:** one transactional RPC or an advisory lock, or catch the conflict on insert.

### 6. Low: `liveStoreSlugs` is unpaginated
- **Where:** `data.ts:173`. PostgREST `max_rows` (1000) would silently 404 store 1001 onward. Fine for one workspace; look up the one slug instead, or `.range`.

### 7. Low: the unknown-store 404 has an empty HTML body before hydration
- **Failure:** `next start`, `/s/nope/xx` → 404 with `<html id="__next_error__">` and an empty body; the Arabic copy appears only after JS runs. Title and noindex are correct.

### 8. Low: `publishPage` does not re-check the product server-side
- **Failure:** only the UI disables Publish; a direct action call publishes a page (inactive product or no `sale_price`) that then answers 404.
- **Fix:** re-check active + `sale_price` in the action.

### 9. Low: orphan `<label>` in the page editor
- **Where:** `page-editor.tsx:189` (`<Field label>` with no `htmlFor`; DevTools logs "No label associated with a form field" on every load). The combobox has an aria-label, so the name is fine.

### 10. Low: focus is lost after the unpublish dialog closes
- **Failure:** after Escape, `document.activeElement` is `BODY`. **Fix:** `onCloseAutoFocus` back to the trigger.

### 11. Low: the disabled Unlink button explains itself only through `title`
- **Where:** `page-editor.tsx:203`. **Fix:** visible helper text.

### 12. Low: duplicate accessible names in the editor
- **Failure:** the heading block and the text block fields are both named "Text". **Fix:** add the block type or index.

### 13. Low: AR editor alignment
- **Failure:** the Latin page title is right-aligned and the slug left-aligned (`editor-ar-dark.png`); the slug is correctly `dir=ltr`.

### 14. Low: public product page at 1280 px
- **Failure:** the title / price / sizes column floats at the top beside a 650 px image with a large empty area (`store-1280-light.png`). No order form yet (STORE-3/4).

## Checked and OK
- **Grants / RLS:** `anon` has no grants; `authenticated` has only SELECT/INSERT/UPDATE/DELETE on `stores` and `store_pages`; 00049 policies match the brief, UPDATE has USING and WITH CHECK, composite FKs in place. Rolled-back probe: an admin of another workspace saw, updated and deleted 0 rows of both tables.
- **DTO:** explicit columns, no cost fields, published-only.
- **Invalidation:** every store action and every product action that changes public output calls `updateTag`; webhook and cron use `revalidateTag('store-public','max')`, the webhook only after a valid signature.
- **Proxy / route move:** `/s` sends no Set-Cookie and serves `lang="ar" dir="rtl"` even with an `en` cookie; `/settings` still matched by the proxy; ISR MISS then HIT with `s-maxage=120`; `/app/dashboard` still 307 → `/login`.
- **Public store (`/s/maison-test/first`, AR/RTL, light):** no horizontal scroll at 390 px, no tap target under 44 px, price isolated LTR ("9 900 دج"), out-of-stock sizes have strike-through + dashed border + sr-only "غير متوفر", missing slug page is styled and in Arabic.
- **Admin pages (hub, pages list, editor, settings):** theme tokens in dark and light, EN and AR; nav, breadcrumb and title agree; chevrons mirrored; LTR inputs for phone / WhatsApp / Instagram / slug; visible focus ring; empty states have an action; unpublish uses a Radix dialog; Publish is gated with a reason.

## Missing tests
- "Variant stock change shows" incl. the uncounted case (finding 1) — **medium**.
- Agent session cannot load Store admin page data (finding 2).
- Cache behaviour through `unstable_cache` / ISR (publish after a cached 404, slug rename, price change): still absent — low; cheap guard: mock `next/cache` and assert every store/product action calls `updateTag('store-public')`.
- DB error not cached: only the store lookup is covered; page, product, variant and related throw paths are not — low.
- `store_pages` cross-workspace RLS test (probe shows the policy holds) — low, cheap.
- `store-http.test.ts` still skipped in the gate (`STORE_E2E_URL`); its checks were run by hand except `?preview=1` on a draft.

## Not checked
- Loading skeleton and error-with-retry states live (code read only; the error message is generic).
- Admin editor at 390 px; EN light editor and pages list; AR light pages list and editor; AR dark hub and pages list; AR plural forms on the hub; contrast scan on dark pages.
- Public page with a long Arabic name, single size, no announcement.
