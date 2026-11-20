VERDICT: FIX

## Summary
The breadcrumbs, hubs, required subtitle and RTL chevrons work, agent scoping is correct and nav-model tests pass (30).
But every record page (orders/[id], products/[id]) gets stuck in a render loop ("Maximum update depth exceeded").
Some titles still differ from the sidebar labels, orders/[id] shows two breadcrumbs, and the store preview lost its way back to the editor.
The ui-reviewer judged the live app with chrome-devtools. Screenshots are in docs/design/audit/NAV-2/.

## Findings (ranked)

1. **HIGH: render loop on record crumbs.** `src/components/breadcrumbs.tsx:20` and `:31-34`
   - Failure: `CrumbProvider` passes a new inline setter `(l) => setRec(...)` on every render. `CrumbRecord`'s effect depends on `[set, label]`, so the loop runs:
     1. the cleanup sets null and then the label,
     2. the state changes and the provider re-renders,
     3. a new setter is created and the effect runs again.
   - Seen on /app/products/<id> (454 console repeats) and /app/orders/<id> (182 repeats), in AR, light, 390 px. It burns CPU and shows the dev error overlay.
   - Fix: make the setter stable with `useCallback` (keep the pathname in a ref), and use a functional `setRec` that returns the previous state when path and label are unchanged.

2. **MEDIUM: titles differ from sidebar labels** (the brief's done-when requires them to match).
   - /app/orders/all shows "Orders"; the sidebar says "All orders".
   - /app/contacts/suppliers shows "Contacts"; the sidebar and crumb say "Suppliers".
   - /app/team/tasks shows "Team & rules"; the sidebar says "Tasks".
   - `src/app/(app)/app/orders/[id]/page.tsx:47` uses `orders.title`.
   - Fix: reuse the `nav.*` keys (`nav.all`, the suppliers leaf key, `nav.tasks`).

3. **MEDIUM: double breadcrumb on /app/orders/<id>.**
   - The top bar has the shared trail, and the page still renders its own in-page "Orders ›" back crumb (order-ar-light-390.jpeg).
   - Fix: remove the in-page crumb.

4. **MEDIUM: store preview is a dead end.** `src/app/(app)/app/store/pages/[id]/preview/page.tsx:38`
   - The old Crumbs had a "Preview" tail and a link to the editor. The trail is now Store › Product pages › {title}, and the title is the last item, so it is not a link and there is no way back to /app/store/pages/<id>.
   - This was checked in code only (the seed has no store pages).
   - Fix: let the preview supply a linked record crumb (href to the editor) plus a "Preview" tail. One way is to extend `CrumbRecord` with an optional `href` and a tail.

5. **LOW: related-links row is hard to read and duplicates the tabs.** `src/components/page-header.tsx:~33`
   - It is muted `text-xs`, does not read as links and is below 4.5:1 contrast.
   - On Expenses, Ad spend and Accounts it repeats the finance tab bar directly under it.
   - Fix: use foreground colour with an underline, or drop it where a tab bar already exists.

6. **LOW: "…" not reachable at 390 px.** `breadcrumbs.tsx:52-55`
   - The collapsed group is `aria-hidden` plain text, so the group hub cannot be reached from the crumb on mobile.
   - Acceptable, but say so in a comment, or make it a link to the group href.

7. **LOW: record tail lacks direction isolation.** `breadcrumbs.tsx:66-68`
   - The tail (an order number or a Latin product name) inside RTL has no `<bdi>` or `dir="auto"`, so the punctuation order can come out wrong.

8. **LOW: hub live counts not verified.**
   - The brief asks for counts on Confirmation and Shipping where they are cheap. They were not seen on /app/sell (not captured). Confirm they are there, or record that they were skipped.

## Coverage gaps (reviewer did not capture)
- Hubs at 390 px and in light theme.
- Sell, Catalog, Team and Store hubs at 1280 px.
- AR for most pages.
- Delivery agent.
- store/pages/<id> and its preview (no seed rows).
- Re-check these after the fix.

## Missing tests
- A component test that `CrumbRecord` sets the tail without a render loop, e.g. by counting renders. This is a regression test for finding 1.
- A test that each `/app` page title key equals its sidebar `nav.*` key, or a static map check.
- A `crumbsFor` case for the delivery agent.
- A `crumbsFor` case for the store preview path, covering the editor link and the Preview tail.
- A `GroupHub` test that it renders only `visibleNav(role)` leaves.
