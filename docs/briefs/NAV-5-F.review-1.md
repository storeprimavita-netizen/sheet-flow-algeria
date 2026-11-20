VERDICT: FIX
## Summary
ui-reviewer (live, chrome-devtools, worktree copy on `next dev --webpack`). The `my-day.ts` last-row fix is correct, the labels have EN/AR parity, and every test the brief names exists and passes (the RLS suite passes once `LOCAL_SUPABASE_URL` is set).
Brief step 5 (d) is not done. The 768 px dashboard overflow reproduces on this branch and was left unfixed.
The dev server returns 500 on every page because of a Tailwind class extracted from a brief doc. This was already on `v3`, but it is why nobody could check the UI.
Live checks passed for My day at 390/768/844-landscape (EN/AR, dark/light) and for focus returning to More (AR, Escape).
Screenshots: `docs/design/audit/NAV-5-F/`.

## Findings (ranked)

1. **MEDIUM**: the step 5 (d) overflow reproduces and was not fixed. File: `src/app/(app)/app/dashboard/*` (filter card).
   - At 768 px `/app/dashboard`, `scrollWidth` is 806 against 768, in EN and AR, dark and light.
   - Cause: the filter card uses `card-surface … sm:sticky sm:w-fit` with `sm:grid-cols-[16rem_14rem]`. That makes it about 518 px wide inside the 512 px main column next to the 256 px sidebar, and its left edge lands at -38.
   - 844 px landscape does not overflow.
   - The PROGRESS.md entry says (d) was "NOT checked", which is now wrong.
   - Fix: use `md:w-full lg:w-fit` on the card, or `grid-cols-[minmax(0,16rem)_minmax(0,14rem)]` below `lg`, with logical props only. Re-check `scrollWidth` equals the viewport at 768 in EN and AR, then correct PROGRESS.md.

2. **MEDIUM (already on `v3`, blocks every UI check)**: Tailwind picks up the literal `w-[calc(16rem+env(...))]` from `docs/briefs/NAV-5.review-3.md:19`. Turbopack then fails with "Parsing CSS source code failed" (generated globals.css:808), so `npm run dev` returns 500 on every page.
   - Fix: exclude docs from Tailwind scanning (`@source not` for the `docs/` directory in the app's Tailwind CSS entry), or rewrite that line so it is not a valid class candidate.
   - Then confirm `npm run dev` (Turbopack) serves `/app/my-day`.
   - It belongs here because the brief requires a live check and the builder could not run the app.

3. **LOW**: the hint under "Waiting for first call" (10), `needsAction.toConfirmHint` in en.json, still reads "Orders waiting for a confirmation call."
   - The bar badge shows Confirmation 18, so the screen still does not explain why the two numbers differ.
   - Fix: reword the hint to say it counts wait only, and that the Confirmation badge also counts no answer and closed phone. Update the AR twin too.

4. **LOW (already there)**: at 390 px AR, the dashboard card label "التكلفة لكل طلب م…" is cut off with an ellipsis. Optional: let it wrap, or give it a shorter AR string.

5. **LOW**: the `mobile-bottom-bar.test` test for "focus returns to More" only checks that the ref is wired, not where focus ends up. The live check passed: Escape put `document.activeElement` back on the "المزيد" button. Optional: add a user-event test that opens the sheet, presses Escape and expects focus on More.

## Missing tests
- None against the brief list.
- Optional: an RTL test asserting focus lands on More after Escape (finding 5).

## Not verified live
- Admin dashboard in EN light and AR dark.
- Focus returning to More in the admin bottom bar.
- Keyboard focus-ring visibility.
- Loading and error states in the browser.
- 1280 px.
- The delivered-then-reverted scenario in the UI (it is covered by the unit and RLS tests).
- Full `scripts/gate.sh` was not run by the reviewer.
