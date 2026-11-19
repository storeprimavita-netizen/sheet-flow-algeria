VERDICT: FIX

## Summary
The security core holds. Checked live: anon has no grant; agents see 0 rows and their updates change 0 rows; UPDATE has USING + WITH CHECK; composite FKs and triggers are present; the DTO has no ids; the verified flag is recomputed in the DAL.
Review-1 items #1-#4 and #6-#8 are resolved. #5 (screenshots) is only partly resolved.
Two medium findings block PASS: on a phone the admin list's actions are off-screen, and the screenshot/bidi DoD is incomplete.
Reviewers: qa-reviewer (owasp-security) and ui-reviewer (chrome-devtools; reviewer shots in docs/design/audit/STORE-7/rev2-*).

## Findings (ranked)

1. **Medium (ui): admin review actions are unreachable at 390 px.** `src/app/(app)/app/store/reviews/page.tsx` (list table).
   - Failure: the table scrolls inside `overflow-x-auto` (scrollWidth 589, clientWidth 356). In AR the Status, approve switch and Delete columns sit off-screen (switch at x=-118) and nothing shows the table can scroll. On a phone the main actions are hidden.
   - Fix: below `md`, stack each row as a card, or move the switch and Delete into the first visible column.

2. **Medium (DoD): screenshot self-critique is incomplete, and one bidi bug is left.** `docs/design/audit/STORE-7/` and `src/components/store/review-blocks.tsx:396`.
   - Missing shots: the admin preview, public at 1280, a 6-column size table, the three empty states, the error state, and the keyboard pass.
   - Stale shot: `public-320.png` predates the `dir="auto"` fix (e8d1351). It still shows mirrored Latin text.
   - Bidi bug: `.store-note` has no `dir="auto"`, so a Latin note such as "Mesures en cm" mirrors in RTL.
   - Fix: add `dir="auto"` to the note, retake the missing shots in both themes and EN/AR, and note them in PROGRESS.md.

3. **Low: the review count can disagree with the cards shown.** `src/lib/store/data.ts:659-673` vs `:706-707`.
   - Failure: an approved review whose body is only emoji (inserted directly through PostgREST, or older than the refine) is counted in count/avg but dropped from the list. The page shows "2 reviews" with 1 card.
   - Fix: add a DB CHECK, or count only the rows that would render.

4. **Low: a full name can still go public.** `src/lib/store/reviews.ts:913-915`.
   - Failure: comma, slash, apostrophe and the Arabic comma "،" are not treated as separators, so "Amina,Benali" and "Ali/Benali" are shown whole.
   - Fix: split on `/[^\p{L}\p{M}]+/u`.

5. **Low: `src/components/delete-button.tsx:232-235`.**
   - Silent no-op: with neither `table` nor `action` set, the button does nothing and shows no error.
   - Lost filters: `router.push(redirectTo)` drops the review filters.
   - Fix: make the props a discriminated union, and use `router.refresh()` on the action path.

6. **Low: AR order link renders as "الطلب 67#".** Same table as finding 1. Fix: wrap the number in `<bdi>`.

7. **Low: the review switch is 36x20 px, a small touch target.** Fix: enlarge its hit area.

8. **Low (accepted, noted only):**
   - The "order confirmed" mark can stay stale for up to 120 s after the order changes, because order edits do not invalidate the public cache.
   - `createReview` accepts a product that has no store page. The list already labels it "no store page".

## Missing tests
- `data.test.ts:586`: assert `count === items.length`, or document the gap, when an approved emoji-only review exists.
- Preview equals public: compare `assembleProductPage` reviews from an admin session client and from the service client (the brief lists this test).
- `publicReviewName` with comma, slash, apostrophe and Arabic-comma names.
- `DeleteButton` with `action`: a failing action shows an error and does not navigate.
- Render test: a Latin review body and a Latin note both get `dir="auto"`; the order number is wrapped in `<bdi>`.
- The admin list actions are reachable at 390 px.
