VERDICT: PASS

## Summary
Diff review 3 of `git diff v3...v3-STORE-7`, by qa-reviewer (with owasp-security) and ui-reviewer. Neither found a high or medium issue.
Security core verified on the local DB: anon has no grant; agents see 0 rows; the admin is limited to their own workspace; UPDATE has USING + WITH CHECK; composite FKs and the 3 triggers are present; the DTO carries no ids; all actions re-check admin, validate with zod, filter by workspace, check row counts and invalidate.
Review-2 mediums are fixed: admin rows are mobile cards (no horizontal scroll at 390 px), and the `dir=auto` bidi bug is fixed. The remaining findings are low and can be follow-ups.

## Findings (ranked, all low)
1. **Low: bidi in the admin list.** `src/app/(app)/app/store/reviews/page.tsx:401,403`. A Latin name or body in the AR UI puts its punctuation on the wrong side (`r3-admin-list-ar-light-390.png`). Fix: `dir="auto"` on the body `<p>`, `<bdi>` around the name.
2. **Low: AR order link still reads "67# الطلب"** (review-2 #6 only partly fixed). `page.tsx:414`, `ar.json:1458`. `<bdi>` wraps the whole message instead of the `#n` token. Fix: `t.rich` with `<bdi dir="ltr">#{n}</bdi>`.
3. **Low: line breaks in public review bodies are collapsed.** `src/lib/store/data.ts:505` uses `stripEmoji` (`src/lib/store/url.ts:26`, `.replace(/\s+/g," ")`). A multi-paragraph review renders as one block. Fix: strip emoji while keeping `\n`, and add `white-space: pre-line` on `.store-review-body`.
4. **Low: the order # is cleared after an `order_not_found` error.** `review-form.tsx:168,190`. React 19 resets uncontrolled fields after the action resolves, so the admin has to retype the value. Fix: make `order_seq` a controlled input.
5. **Low: a thrown action leaves the UI stuck.** `src/components/delete-button.tsx` `del()`, `review-row-actions.tsx` `toggle()`. On a network failure or an expired-session redirect, busy/pending stays set and the rejection is unhandled. Fix: try/finally plus an error toast.
6. **Low (scale): the summary pages through every approved body on each cache miss.** `data.ts:470-487`. Fine at current volume. Later: a renderable flag or a `security invoker` SQL function that returns avg/count.
7. **Low: list keys use the array index.** `src/components/store/review-blocks.tsx` (ReviewCard/ReviewsSection). Harmless because the list is static. Fix: key on date + index.
8. **Note: a single joined name token of 12 letters or fewer (e.g. "AminaBenali") is shown in full.** `src/lib/store/reviews.ts:732`. The admin hint covers this.
9. **Accepted (review-2): the "order confirmed" mark can stay stale for up to 120 s.**

## Missing tests
- Admin list render: name/body isolated with `dir="auto"`/`<bdi>`; `#n` token isolated in AR.
- `ReviewForm` keeps the order # after `order_not_found`.
- `DeleteButton`/`runDelete` and the review toggle when the action throws.
- Public review body keeps line breaks after the emoji strip.
- Summary vs items with 1000+ approved rows (exercises the paging loop).
- Live-DB `createReview` with another workspace's `order_seq` returns `order_not_found` (the current test only checks the mocked `eq`).

## Coverage notes
The reviewers did not run the live vitest suites (`reviews.rls.test.ts`, `data.test.ts`) because they write to the DB. `tsc --noEmit` is clean, and the 25 non-live tests pass. New screenshots: `docs/design/audit/STORE-7/r4-admin-390-dark.png` and `r4-pub-390-light.png`. The light admin, dark public and EN public views rely on the existing r3 shots.
