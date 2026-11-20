risk: low · surface: ui · lane: shell
(no migration, no RLS change, no new DECISIONS row: D87 (7) already orders the scope below.)

# NAV-5-F — follow-up from NAV-5 (reviews 1-3, D87)

Goal: pin and correct the agent "My day" numbers, label the two "to confirm" figures, and add the tests the NAV-5 reviews named.

## Done when
- A delivery outcome reverted the same day (delivered -> returning) is not counted as Delivered; counts use the LAST delivery-stage row per order.
- A second courier's order delivered today is not counted for the first courier.
- The admin-change test also asserts "to call again" +1.
- The delivery queue title says it is the team queue.
- Admin never sees two unexplained numbers for "to confirm".
- Tests listed below exist and pass; `scripts/gate.sh` GATE OK with the live DB suite not skipped (D24).
- (d) is fixed only if it reproduces on `v3`. (e) is NOT built.

## Facts found in code
- `src/lib/my-day.ts:104-107`: the delivery read filters `to_status in (delivered, returned)`, so the last-row rule in `countDelivery` never sees a later revert. `countMyChanges` and `countDelivery` are the same last-row-per-order logic (duplicated).
- Badge count (`src/app/(app)/app/layout.tsx:24-29`) = `ACTIONABLE_CONFIRMATION` (wait/no_answer/closed_phone = 18). Dashboard card `needsAction.toConfirm` (en.json ~977, "Orders waiting for a confirmation call") = wait only (10). Both are right; the labels do not say so.
- Queue labels: `myDay.queueDelivery` = "Orders to deliver" (workspace-wide on purpose, filter as the layout counter).
- Existing tests: `my-day.test.ts` (2 unit), `my-day.rls.test.ts` (5 live), `admin-guard-layout.test.tsx`, `mobile-bottom-bar.test.tsx` (2), `my-day.render.test.tsx` (1), `role-home.test.ts`. `my-day/layout.tsx` guard, root `/` redirect, loading/error states have no test.

## Files and change
1. `src/lib/my-day.ts`: delivery query drops the `in("to_status", ...)` filter (keep `stage='delivery'`, `orders!inner(assigned_delivery_agent)=me`, order by created_at,id, limit 1000). `countDelivery` keeps the last row per order and counts only delivered/returned. Share one `lastPerOrder(rows)` helper with `countMyChanges`.
2. `src/messages/{en,ar}.json`: `myDay.queueDelivery` -> "Team queue: orders to deliver" (AR twin). Dashboard: keep one source of truth, so label the card "Waiting for first call" or similar and the bar badge hint stays "Confirmation"; builder picks wording with AR parity. Do not change the counts.
3. Tests (names):
   - `my-day.test`: "delivered then returning same day is not counted", "equal created_at rows resolve by order (tie)".
   - `my-day.rls.test`: "second courier's order delivered today is not counted for me" (fixture), "admin change adds one to call again", assert profile-setup error.
   - `my-day.layout.test` (new): "admin -> /app/dashboard", "agent renders children", "no role does not redirect to itself".
   - root `(app)/page` test: "redirects per role" (admin, confirmation, delivery).
   - `mobile-bottom-bar.test`: "active on sub-route", "99+ cap", "has md:hidden", "focus returns to More on drawer close".
   - `my-day.render.test`: "loading state", "error state shows retry".
4. (d) Reproduce AR overflow at 768 px and 844 px landscape on `v3` (dashboard `scrollWidth` vs 768). If it reproduces, fix with logical props; if not, say so in PROGRESS.md.
5. (e) Not built: `viewportFit: "cover"` and top/side insets stay out. The only thing on this machine is `xcrun simctl` with "iPhone Duo"; no notched iPhone simulator is confirmed. Record it in PROGRESS.md; the safe-area class test is not written.

## Steps (commit + push each)
1. Delivery count fix + unit tests. 2. RLS fixtures/asserts. 3. Labels EN/AR. 4. Guard, redirect, bar and render tests. 5. (d) check/fix. 6. Screenshots, PROGRESS.

## Screenshots (390 px, light + dark, EN + AR)
My day delivery agent (new queue title), admin dashboard needs-action card (new label), bottom bar. Note in PROGRESS.md; no browser MCP -> say so.

## Edge cases
- A long Arabic queue title must wrap, not clip, at 390 px.
- Revert row stays inside the 1000-row limit; ordering by created_at then id keeps "last" deterministic.
- Lowercase `to_status` values of other delivery states must be ignored by the counter, not counted as returned.
