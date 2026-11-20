VERDICT: FIX

## Summary
The guards and the RLS boundary hold. Admin is sent from /app/my-day to the dashboard, agents land on My day, the data layer uses only the session client, no money is shown, and no link leads to a refused page. The 50 tests on the touched files pass, and the live RLS suite ran. The bar works at 390 px and is hidden at 1280 px.
Three mediums block PASS: the delivery agent's counts are inflated by `updated_at`, the D86 "orders assigned to you" label is missing, and two RLS cases would pass without RLS. Reviewers: qa-reviewer and ui-reviewer. Screenshots are in `docs/design/audit/NAV-5/`.

## Findings (ranked)

1. **MEDIUM: the delivery agent's delivered/returned "today" counts are wrong.** `src/lib/my-day.ts:83-84` filters on `.gte("updated_at", since)`. Any later edit moves `updated_at` (cash collection, notes, tracking sync), so an order delivered yesterday and touched today is counted as "Delivered" today.
   **Fix:** count `order_status_history` rows with `stage='delivery'` and `to_status` in (delivered, returned) from day start, joined through `orders!inner(assigned_delivery_agent)` = me. Count each order once. The existing `osh` read policy allows this.

2. **MEDIUM: the label D86(2) and D64(5) require is missing.** In `src/app/(app)/app/my-day/my-day-view.tsx:51` and in `myDay.numbers` in `en.json`/`ar.json`, the block reads only "My numbers today". D86 requires a title naming the agent's own orders of today, plus a helper line "orders assigned to you". This is the explicit "my orders" label that explains the accepted undercount.
   **Fix:** add the helper line, with EN and AR keys.

3. **MEDIUM: RLS tests that prove nothing.** In `src/lib/my-day.rls.test.ts:106-111`, the "other workspace gets zero" case would pass without RLS. The `actor` filter already removes other users' history, and every test order leaves the queue, so `queue` is 0 for anyone. The courier case only asserts zero with no deliveries at all. At `:70`, `before` is never asserted. At `:35`, the profile-update error is ignored, so a broken setup can pass silently.
   **Fix:**
   - Leave one unassigned waiting order in `ws` and assert `other.queue === 0` while `a1.queue >= 1`.
   - Add a delivered order assigned to the courier, plus an old delivered order updated today (this pins finding 1).
   - Assert the setup error.

4. **LOW: the history query can be cut off silently and ties are not ordered.** `my-day.ts:73-79` uses `.limit(5000)`, which is above the PostgREST `max_rows = 1000`, so rows past 1000 are dropped without notice. There is no `.order()`, so two rows with the same `created_at` resolve in whatever order the database returns, and so does the "last change".
   **Fix:** `.order("created_at").order("id")` and a limit of 1000 or less.

5. **LOW: brief item not done (`roleHome` in `AdminGuardLayout`).** `src/components/admin-guard-layout.tsx:9` still redirects to `/app/orders`, and `src/app/(app)/auth/callback/route.ts:15` and the proxy default to `/app/dashboard`. Agents do reach My day, but only after three hops.
   **Fix:** redirect to `roleHome(role)`.

6. **LOW (pre-existing, widened): redirect loop for a signed-in user with no role.** The loop runs `/app/my-day/layout.tsx:9` → `/app/dashboard` → guard → `/app/orders` → `/app/sell/orders` → guard → loop. `roleHome(null)="/login"` is never used, and the proxy sends `/login` back to `/app/dashboard` anyway (`src/lib/supabase/session.ts:50`).
   **Fix:** a "no access / sign out" page. This can be a follow-up task.

7. **LOW: the bulk-action bar covers the bottom bar on phones.** `src/components/data-table/data-table.tsx:416` is `fixed bottom-6 z-30`, while the bottom bar is about 56 px plus the safe area at `z-20`.
   **Fix:** under `md`, offset it by the bar height plus `env(safe-area-inset-bottom)`.

8. **LOW: no themed focus ring on the bar.** `src/components/mobile-bottom-bar.tsx:12` (`itemClass`) has no `focus-visible` style, so keyboard focus shows the browser's default blue outline, which is not a token and is weak on dark.
   **Fix:** `outline-none focus-visible:ring-2 focus-visible:ring-ring`.

9. **LOW: the safe-area padding has no effect.** No `viewport = { viewportFit: "cover" }` exists in `src`, so `env(safe-area-inset-bottom)` is 0 on iOS (`mobile-bottom-bar.tsx:30`, main padding in `app-shell.tsx`).
   **Fix:** export `viewportFit: "cover"` from the root layout and re-check the header on a notched device.

10. **LOW: two different counts for "to confirm".** The bar's Confirmation badge shows 18, while the admin dashboard's "To confirm" card shows 10. They use different definitions.
    **Fix:** share one count source, or label them differently.

## Missing tests
- `my-day/layout.tsx` guard: admin → `/app/dashboard`, agents pass, no role does not loop.
- Root `/` redirect for each role.
- Delivery counts when an old delivered order is touched today. Two history rows with the same timestamp. An agent's `confirmed → wait_for_confirmation` change counts as "to call again" (D86).
- Bar: active state on sub-routes (`/app/sell/confirmation/...`), the "99+" cap, not rendered or hidden at `md` and above, focus returns to More when the drawer closes.
- My day loading and error states. The render test covers only the populated and empty views.

## Screenshot coverage (ui-reviewer)
- **Captured:** confirmation agent AR dark (with drawer), AR light and EN light at 390 px; delivery agent AR light at 390 and 1280 px, plus EN dark taken at 500 px by mistake; admin EN dark at 390 and 1280 px.
- **Not captured:** delivery agent EN light and AR dark at 390 px, admin in AR and in light, 768 px, My day loading and error states.
- **Builder must:** capture the missing ones after the fixes.
