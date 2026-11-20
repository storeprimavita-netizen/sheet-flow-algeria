VERDICT: FIX

## Summary
Reviewers: qa-reviewer (owasp-security) and ui-reviewer, routed because the brief is risk high with surface ui,security.
The security core holds. The QA reviewer checked it live in rolled-back transactions: anon has no grant, an agent session reads 0 rows and its insert is blocked, all four policies exist (UPDATE has USING and WITH CHECK), the composite FKs and triggers are in place, and "verified" is recomputed in the DAL.
Medium findings block PASS: the rating count disagrees with the list, the summary is silently capped at 1000 rows, the public name can show in full, delete does not use DeleteButton, and the required screenshots (brief step 9) are missing.

## Findings (ranked)

1. **Medium — `src/lib/store/data.ts:141-142` + `src/components/store/product-view.tsx:80` + `src/components/store/review-blocks.tsx:115`** (both reviewers)
   - **Failure:** `count` and `avg` come from every approved rating, but the list drops reviews whose body is empty after emoji stripping. Suppose every approved review is emoji-only: `RatingLine` shows "4.5 · 3 reviews" and links to `#reviews`, but `ReviewsSection` returns null, so the anchor does not exist. With a mix of reviews, the count also disagrees with the cards shown.
   - **Fix:** compute count and avg from the same filtered set. Or reject emoji-only bodies in `createReview` (zod refine on `stripEmoji(body).trim()`) and gate `RatingLine` on `items.length > 0`.

2. **Medium — `src/lib/store/data.ts:128,141`** (both reviewers)
   - **Failure:** the plain `select("rating")` is capped by PostgREST `max_rows = 1000` (`supabase/config.toml:19`). Past 1000 approved reviews, the count and average are silently wrong.
   - **Fix:** use `select("rating", { count: "exact", head: true })` for the count. Compute the average with a `.range()`-paged fetch or a small `security invoker` SQL function. Avoid a PostgREST aggregate, per the brief.

3. **Medium — `src/lib/store/reviews.ts:5`** (qa)
   - **Failure:** `publicReviewName` splits on a literal `" "` only. "Amina-Benali", "Amina.Benali", a no-break space or a zero-width space all give one token, so the full name goes public. That breaks the DoD rule "name = first name + initial".
   - **Fix:** split on `/[\s\-._ ​-‍]+/u`. If one token remains and it is long, truncate it.

4. **Medium — `src/app/(app)/app/store/reviews/_components/review-row-actions.tsx:37`** (ui)
   - **Failure:** delete uses an unthemed `window.confirm` and a custom button. That breaks the AGENTS.md / brief rule to reuse `DeleteButton`, and it differs from the other store pages.
   - **Fix:** use `DeleteButton` with `deleteReview`.

5. **Medium — brief step 9 / DoD "screenshots done"** (ui; confirmed by the PROGRESS.md note)
   - **Failure:** only the `/app/store/reviews` empty state was captured, in EN dark. None of these was captured:
     - the populated list, the form, the editor size grid, the preview, the public page at 390/320/1280
     - light theme, AR/RTL
     - a 1000-character Arabic body, a 6-column table
     - a keyboard pass
   - **Fix:** seed a live store page with reviews and a size guide, capture every state above into `docs/design/audit/STORE-7/`, fix what the screenshots show, and note it in PROGRESS.md.

6. **Low — `src/app/(app)/app/store/reviews/page.tsx:85`** (both)
   - **Failure:** the orders lookup ignores `error`. On failure, every row silently shows "no order".
   - **Fix:** throw on error, as the other queries do.

7. **Low — `src/app/(app)/app/store/reviews/page.tsx:~66`** (qa)
   - **Failure:** only reviews whose product has a store page are listed. If a page is deleted or its product changes, those reviews become orphaned: they stay in the table but cannot be seen or deleted from the UI.
   - **Fix:** list every review in the workspace, or show orphans with a "no page" label.

8. **Low — `review-row-actions.tsx:20`** (ui)
   - **Failure:** `useState(approved)` does not resync after `router.refresh()`, so the switch can go stale.
   - **Fix:** key the component on `id + approved`, or derive the state from props.

9. **Low — `store.css` `.store-stars-icons` / `rating-input.tsx`** (ui)
   - **Failure:** in light mode, selected and unselected stars differ only by fill. The non-text contrast of `--gold` on `--surface-200` and of `text-warning` against muted is unverified (needs ≥ 3:1).
   - **Fix:** verify during the screenshot pass. Add an outline on unselected stars if needed.

10. **Low — "order confirmed" staleness** (qa)
    - **Failure:** an order that is later cancelled or excluded keeps the mark until the cache revalidates.
    - **Status:** the window is bounded at 120 s. Acceptable, noted only.

11. **Low — `createReview` product scope** (ui)
    - **Failure:** `product_id` is checked only by the workspace FK, not against published store pages.
    - **Status:** the table is admin-only. Optional check.

## Missing tests
- Emoji-only body: the summary count equals the rendered list, and the rating line is hidden when no card renders.
- More than 1000 approved ratings: the count and average are still correct (or a unit test on the paging logic).
- `publicReviewName`: hyphenated, dotted, NBSP and zero-width-space names.
- Preview equals public: `assembleProductPage` with the admin session client and with the service client returns the same `reviews`.
- Live RLS: an `adminA` session insert with an order from workspace 2 fails, and one with `workspace_id = ws2` fails. The current check runs only as service role (`reviews.rls.test.ts:104-110`).
- Verified flips: confirm the order, then cancel it or set `excluded_reason`, and the DTO shows `verified: false`.
- The actions test asserts the `.eq("workspace_id", …)` filter on the `order_seq` lookup, not only the `maybeSingle` mock.
- Render tests:
  - `SizeguideSection` hides columns that are empty in every row.
  - With no reviews block, nothing renders.
  - With a reviews block and 0 approved, nothing renders.
