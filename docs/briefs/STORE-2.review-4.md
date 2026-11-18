VERDICT: ESCALATE

## Summary
Round 4 of the diff (`git diff v3...v3-STORE-2`, HEAD 7a21aec). qa-reviewer and ui-reviewer both ran. All review-3 findings are fixed: the D54.4 formula is applied, the admin guard holds for agent sessions (checked live over HTML/RSC and PostgREST), and the in-app not-found page reads correctly in EN/AR, dark/light. One medium is left: a negative *not assigned* count cancels real per-size counts. The rule says ESCALATE at n ≥ 3 without PASS. The fix is one line and needs no owner decision; the owner decides whether to allow a round 5.

## Findings (ranked)

### 1. Medium: D54.4 check is wrong when *not assigned* is below zero
- **Where:** `src/lib/store/data.ts:136` (`inStock: v.stock + unassigned > 0`; `unassigned` is set at :129).
- **What breaks:** D54.2 and D54.5 both allow *not assigned* to go below 0: after a count, before the admin adds the correction line, and when an old order ships after the count. A negative value then cancels sizes that really have stock. qa reproduced this in a rolled-back transaction on Abaya Noor (total 142): a count of 140 / 5 / 5 leaves *not assigned* at −8, and both sizes with 5 pieces on the shelf come back `inStock=false`. This breaks D54.4: once a product is counted, each size is checked on its own, and a count must never stop a sale. STORE-4 will reuse this check to refuse orders.
- **Fix:** `inStock: v.stock + Math.max(0, unassigned) > 0`.

### 2. Low: `getStore()` ignores DB errors
- **Where:** `src/app/(app)/app/store/_lib/data.ts:19-25`.
- **What breaks:** a DB error returns null, so the hub offers "Create store", which then fails with `exists`. The `store_pages` list queries on the hub and the pages list also ignore `error`.
- **Fix:** throw on `error`, as `src/lib/store/data.ts` does.

### 3. Low: `linkPageProduct` skips the active/price check
- **Where:** `src/app/(app)/app/store/actions.ts:120-135`.
- **What breaks:** a published page can be re-linked to an inactive product, or to one with no `sale_price`. The public page then returns 404. This is the same gap review-3 #8 closed for `publishPage`.
- **Fix:** run the same check as `publishPage` when the page is published.

### 4. Low: not-found CTA points agents to an admin-only page
- **Where:** `src/app/(app)/app/not-found.tsx:17`.
- **What breaks:** the button always links to `/app/dashboard`. For an agent that redirects to `/app/orders`, so the "Back to the dashboard" label is wrong.
- **Fix:** link to the role's home page, or use a neutral label. Also add `metadata` with the "Page not found" title; the tab currently shows "MNW ERP".

### 5. Low: agent 404 is sent with HTTP 200
- **What happens:** `notFound()` is streamed from the layout, so the response status is 200. The page carries `noindex` and leaks no data. Informational only.
- **Also check:** in dev, the RSC payload carries a stack trace with local file paths. Confirm once on `next start` that production strips it.

### 6. Low, carried over from review 3
- #5: `createStore` race; lines 44-49 still ignore the `delete` result.
- #6: `liveStoreSlugs` is still unpaginated.
- #7: `/s/nope/xx` still sends no `<h1>` in the HTML before hydration (checked on the dev server only).

## Missing tests
- **Medium:** D54.4 when *not assigned* is below 0 (finding 1), and an inactive variant holding stock inside the total.
- **Low:** no agent-session HTTP test of the guard. `store-http.test.ts` is skipped in the gate without `STORE_E2E_URL`, and `admin-guard.test.ts` mocks `getStore`/`requireStoreAdmin` without checking that the editor and preview pages call them.
- **Low:** `linkPageProduct` to an inactive product; `getStore` when the DB errors; a render test for `not-found.tsx`.

## Notes
- **Local DB:** qa's probe briefly renamed local store `maison-test` to "x" outside a transaction. qa restored the name ("Maison Test", taken from the audit log). Two extra rows stay in the add-only `audit_log` on the local DB only.
- **Screenshots:** `docs/design/audit/STORE-2/round4/`.
