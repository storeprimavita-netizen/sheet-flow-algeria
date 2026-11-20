VERDICT: FIX

## Summary
Reviewed the diff `git diff v3...v3-STATS-2` with qa-reviewer and ui-reviewer. The SQL and security are sound: both functions are security invoker, PUBLIC and anon cannot execute them, and agents get zero rows (confirmed with a delivery-agent JWT). The drill predicates match `kpi_rates`. The 8 live-DB tests and 46 component tests pass, and tsc is clean.
Six medium findings block a PASS: drill-mode UX on orders/all, a swallowed drill error, orders with no wilaya dropped, and the 390px layout plus the error reason on the statistics page.
Not verified: Arabic and light theme (light emulation stayed dark), empty state, real error state, agent redirect. Re-screenshot these after the fix.

## Findings (ranked)

1. **MEDIUM — `src/app/(app)/app/orders/all/page.tsx:66-68`: a failed drill RPC is shown as "no orders".**
   `drillError` is only logged, `drillIds` becomes `[]` and the page shows the empty state. This breaks the four-states rule.
   Fix: route `drillError` to the existing `loadError` + retry block.

2. **MEDIUM — `src/app/(app)/app/orders/all/page.tsx:~79-118`: drill mode silently ignores the other filters.**
   `OrdersFilterBar` keeps unknown params (`orders-filter-bar.tsx:48`), so `drill` and `commune_key` stay in the URL. After that, status, source, agent and search filters and the sort headers do nothing. Example: open a delivered drill, pick status "cancelled", and the same delivered list still shows. Nothing on the page says drill mode is on.
   Fix: show a drill banner (metric, wilaya, commune) with a clear link, and drop `drill`/`commune_key` when any other filter or sort changes.

3. **MEDIUM — `src/app/(app)/app/statistics/page.tsx:44`: orders with no wilaya disappear.**
   `orders.wilaya_code` is nullable. `kpi_by_wilaya` returns a NULL group, but the page filters it out with `r.wilaya_code != null`. The table then no longer adds up to the dashboard totals.
   Fix: render an "Unknown wilaya" row through i18n. Either give it no drill link, or add an unknown-wilaya flag to `kpi_drill_orders` the way `p_unknown` works for communes.

4. **MEDIUM — `src/components/stats/wilaya-table.tsx:~105` (`min-w-[32rem]`, `min-w-32` bar columns): at 390px, Delivery and Return are off-screen and Confirmation is partly cut.**
   The brief requires keeping received, confirmation, delivery and return visible at 390px.
   Fix: a compact layout below `sm`, with narrower bars or a stacked rate cell.

5. **MEDIUM — `src/components/stats/commune-panel.tsx:~35-46, 112-121` (inside the `colSpan` td of `wilaya-table.tsx:~123`): the commune panel scrolls inside the table's overflow container.**
   At 390px the avg days / home / stop-desk line is clipped, and stop-desk is unreachable without scrolling. The commune table also has no sticky first column.
   Fix: make the panel `sticky start-0` at viewport width, or render it outside the scroll container. Add `sticky start-0 bg-surface` to the commune name th and td.

6. **MEDIUM — `src/app/(app)/app/statistics/error.tsx:~17`: the error state shows the generic `errorPage.body`.**
   The brief asks for reason + retry.
   Fix: add a statistics-specific message ("Could not load wilaya figures") plus the digest, in en and ar.

7. **LOW — `supabase/migrations/00058_kpi_by_wilaya.sql:11`: `kpi_group_extras` has no `is_admin()` gate and is granted to authenticated.**
   An agent can call it directly and get shipped, home, stop-desk and avg_days over the orders RLS lets them see. D64 rules out exactly this "rate over the part the role can read". No money is exposed, and `kpi_rates` already allows the same thing.
   Fix: add `where public.is_admin()`, or revoke execute from authenticated. Nothing breaks: its callers are invoker functions run by admins.

8. **LOW — `statistics/page.tsx:28` vs the orders/all drill: date validation differs.**
   The page sends raw `from`/`to` to the RPC, but the drill only accepts `^\d{4}-\d{2}-\d{2}$`. With `?from=20260310` the table filters by date and the drill does not, so the counts differ.
   Fix: validate once with a shared zod schema or regex.

9. **LOW — `kpi_drill_orders.p_delivery_type` is never sent.** The home and stop-desk counts are not drillable, against "every count links".
   Fix: add a `shipped` drill metric that takes `delivery_type`, or drop the parameter.

10. **LOW — `UNKNOWN_COMMUNE = "__unknown"` can collide with a real commune text, and `slice(0,120)` can cut a long key.**
    Fix: use a token that cannot be a commune (for example a param like `commune_unknown=1`), and reject over-long keys instead of cutting them.

11. **LOW — `metric-cell.tsx:10`, `wilaya-table.tsx:~98`, `commune-panel.tsx:117`: drill links look like plain text until hover.** On touch devices they are invisible.
    Fix: a persistent subtle underline and `focus-visible` styling.

12. **LOW — `wilaya-table.tsx:~91`: the chevron hit area is 28×28px, below 44px.** Fix: enlarge the hit area.

13. **LOW — `statistics/page.tsx:~68`: the empty state has no action when no filter is set.** Fix: link to All orders.

14. **LOW — no visible "Sell > Statistics" breadcrumb in the screenshots.** Fix: check that PageHeader or the layout supplies it, and add it if not.

## Missing tests
- avg_days excluding a *swapped* delivered original (only an undelivered order is tested).
- A drill `return` count with a swap original (the D47 path of the drill), and commune-level confirmed/return drill totals.
- anon and confirmation/delivery-agent calls to `kpi_drill_orders` returning nothing, and to `kpi_group_extras` once it is gated.
- The orders/all page path: unknown-token mapping, param validation, page total equal to the table count.
- Unit tests for `ordersQs`/drill href with `commune_key`, `delivery_type` and the unknown token.
- `aria-expanded` toggling on the commune button.
- An agent opening `/app/statistics` being redirected.
- An AlgeriaMap render test for matured=false; the current test only asserts on the source string.
- Screenshots in AR and light theme, plus the empty and error states (the reviewer could not verify these).
