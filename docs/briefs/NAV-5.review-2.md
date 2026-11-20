VERDICT: FIX

## Summary
Two reviewers ran: qa-reviewer (security/RLS) and ui-reviewer (live browser at 390 / 768 px, both themes, EN and AR).
Security: no high or medium findings. These review-1 items are fixed: #1 delivery counts from history, #2 D86 label, #3 RLS tests, #4 query order and limit, #5 roleHome, #7 bulk bar offset, #8 focus ring. The 5 RLS tests run against the local DB and pass.
One medium remains: `viewportFit: "cover"` was turned on, but the top bar has no top safe-area inset, so on notched iPhones the header sits under the status bar and notch.
Review-1 #10 (two different "to confirm" counts) is still open, as a low.
The builder still took no screenshots of their own. The reviewer's `r2-*` screenshots are committed with this review.

## Findings (ranked)

### 1. MEDIUM: header goes under the notch after `viewportFit: "cover"`
- **Where:** `src/components/app-shell.tsx:417` (`sticky top-0 h-14 … px-4`, no `env(safe-area-inset-top)`), with `src/app/(app)/layout.tsx:11` (`viewportFit: "cover"`).
- **Failure:** on an iPhone with a notch or Dynamic Island, the brand and the search button render under the status bar and are hard or impossible to tap. Before `cover` was set, the browser inset the page itself. The measured header padding-top is 0.
- **Fix:**
  - Header: `pt-[env(safe-area-inset-top)]` and height `h-[calc(3.5rem+env(safe-area-inset-top))]`. Alternatively keep `h-14` on an inner row and pad the outer header.
  - Landscape: add `ps-[max(1rem,env(safe-area-inset-left))]` / `pe-[max(1rem,env(safe-area-inset-right))]` to the header and the bottom bar.
- **Verify:** screenshot at 390 px with a simulated inset, for example by forcing `env()` through devtools or with a temporary CSS var override.

### 2. LOW: other places `viewportFit: "cover"` now affects
- **Drawer bottom:** the drawer (`app-shell.tsx:343`, `fixed inset-y-0`) has only `p-3` at the bottom, so its user and sign-out block sits under the home indicator. Fix: `pb-[env(safe-area-inset-bottom)]` on the aside.
- **Sidebar in landscape:** an iPhone in landscape (≥ md) gets the desktop sidebar, and the sidebar goes under the notch. Fix: `ps-[env(safe-area-inset-left)]` on the aside.
- **Sheets:** they use `p-6` with no bottom inset.

### 3. LOW (review-1 #10, still open): two different "to confirm" counts
For admin, the bar's Confirmation badge shows 18 while the dashboard "To confirm" card shows 10. Use one count source, or label them differently.

### 4. LOW: the delivery queue reads as personal
- "Orders to deliver" counts the whole workspace, using the same filter as the layout counter as the brief requires.
- The "Only orders assigned to you" line that follows it applies to the numbers block, not to this figure, so a courier may read the queue figure as their own.
- Fix: add a qualifier to the queue title, for example "Team queue".

### 5. LOW: nothing pins the courier filter
- `src/lib/my-day.ts` relies on `orders!inner` + `.eq("orders.assigned_delivery_agent", me)`, and `o_sel` lets every courier see every confirmed order.
- If `!inner` were dropped, the counts would silently become workspace totals, and the tests would still pass because the fixture has no delivered order assigned to another courier.
- Fix: add that fixture.

### 6. LOW (from before this branch, follow-up): redirect loop for an inactive profile or one with no workspace
`getProfile()` returns null, so the user goes `/` → `/app/dashboard` → guard → `/app/orders` → … (`src/app/(app)/page.tsx:9`, `admin-guard-layout.tsx:11`). Fix: a no-access page with sign-out, as a follow-up row.

### 7. LOW: My day has no drill-through
- The number tiles, task rows and meeting row are not links. Plain task and meeting rows are what the brief asks for (team/tasks is admin-guarded), so this is acceptable.
- The tiles could link to the filtered queue.
- The empty states other than the queue hero have no action.

### 8. LOW (from before this branch, unconfirmed against v3): AR overflow at 768 px
In AR at 768 px, `scrollWidth` is 806: the dashboard filters and cards clip at the left edge. Not caused by NAV-5. Log it as a follow-up if it reproduces on v3.

### 9. LOW: process
- `PROGRESS.md` still says "Not done: screenshots". The builder must take and note their own screenshots in both themes and both locales, including the header at 390 px after fix 1.
- The "admin change" test (`my-day.rls.test.ts`) asserts only that cancelled is unchanged. It should also assert that callAgain goes up by 1.

## Missing tests
- `my-day/layout.tsx` guard: an admin is redirected to `/app/dashboard` and an agent gets the page.
- Root `/` redirect for each role.
- A second courier's order delivered today does not count for the first courier (finding 5).
- `countMyChanges` with two rows at the same `created_at`.
- Bottom bar:
  - active state on sub-routes;
  - the 99+ cap;
  - hidden at md and up;
  - focus returns to More when the drawer closes.
- Header safe-area class present (finding 1).
- Render tests for the My day loading and error states.

## Evidence
`docs/design/audit/NAV-5/r2-*.png`: confirmation agent EN light/dark at 390 px plus the drawer, delivery agent AR light/dark at 390 px, admin EN dark and AR light at 390 px, and admin AR light at 768 px. What these runs confirmed:
- 390 px: no horizontal scroll, bar items about 130×51 px, `aria-current` on the active item, RTL order mirrored.
- More opens the drawer, and Escape closes it with focus back on More.
- No money is shown to agents.
- An admin opening `/app/my-day` is sent to the dashboard.
- No open redirect.
