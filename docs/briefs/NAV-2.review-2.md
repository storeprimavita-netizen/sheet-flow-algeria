VERDICT: FIX

## Summary
Round 2 (ui-reviewer, judged on the live app at localhost:3000, screenshots in `docs/design/audit/NAV-2/r2-*`).
Fixed from review 1: #1 render loop (no console errors, EN/AR), #3 double crumb, #7 `<bdi>`, #4 preview link (in code only, the seed has no store).
Still open: 3 mediums. Agents have no way back from an order, hubs show no counts, and three team pages still use the title "Team & Rules".
No high findings. n=2, so no escalation.

## Findings

1. **MEDIUM: agents reach a dead end on order detail.** Code: `src/components/nav-model.tsx:188-200` (`crumbsFor`) and `src/app/(app)/app/orders/[id]/page.tsx:~148`, where the role-aware `queueHref` back link was removed.
   - Seen: as the confirmation agent on `/app/orders/<id>`, the top bar shows only "#0066" and nothing links back to the queue (`r2-agent-order-en-light.png`). For the delivery agent, `crumbsFor` returns `[]` because the "all" leaf is not visible to that role.
   - Fix: when the role cannot see the `all` leaf, map the order record to the role's own queue leaf (Sell › Confirmation, or Sell › Shipping). Otherwise, restore the role-aware back link for agents.
   - Test: add `crumbsFor` cases for both agent roles on `/app/orders/<id>`.

2. **MEDIUM: hubs show no live counts.** Code: `src/components/group-hub.tsx:~38`.
   - Seen: on `/app/sell` the sidebar badges show 18 (Confirmation) and 8 (Shipping), but the hub cards for the same leaves show no count (`r2-sell-en-dark-1280.png`).
   - The brief asks for a "live count where cheap", and these counters already exist.
   - Fix: pass the existing sidebar counter source to `GroupHub` and render the count on each card (no new query). If the builder drops this instead, it must be recorded as a decision in PROGRESS.

3. **MEDIUM: titles differ from sidebar labels (review-1 #2, partly fixed).** Code: `team/rules/page.tsx:38`, `team/meetings/page.tsx:70`, `team/performance/page.tsx:188`.
   - Seen: all three pages use `t("team.title")`, which renders "Team & Rules", but the sidebar labels are Rules, Meetings and Performance.
   - The subtitles on Tasks ("Rules, meetings, tasks & performance") and Suppliers ("Customers, suppliers & partners") are also generic or out of date.
   - Fix: on each page, use `nav.<leaf>` for the title and `navPurpose.<leaf>` for the subtitle.

4. **LOW: record name is unreadable at 390 px.** Code: `src/components/breadcrumbs.tsx:~82`.
   - Seen: in AR, light theme, on `/app/products/<id>/pricing` the bar shows "… › المنتجات › …rah" (`r2-product-pricing-ar-light-390.png`).
   - Fix: give the last crumb a minimum width (about 40%), or hide the middle crumb below `sm`.

5. **LOW: `orders/[id]` has no purpose line unless the order has a platform reference.** Code: `orders/[id]/page.tsx:~152`, where the subtitle evaluates to `undefined`.
   - Fix: fall back to `navPurpose.all`, and make the `subtitle` type reject `undefined`.

6. **LOW: the related-links row duplicates the finance tab bar.** On Expenses, "Ad spend / Accounts" sits directly above the same tabs (`r2-expenses-ar-dark-390.png`).
   - Fix: drop `related` on pages that already have those tabs.

7. **LOW: the agent "Sell" crumb links to `/app/sell`, which redirects back to the agent's only leaf.** It loops back to the same page but does no harm.
   - Fix: do not link the group crumb when the role has only one leaf in that group.

8. **LOW: the delivery agent gets a bare not-found state on an inaccessible order.** It is titled "All orders" (`orders/[id]/page.tsx:46`) and has no crumb or back link.
   - Fix: add a back link to the role's queue.

## Missing tests
- No regression test for the round-1 render loop: the stable setter / render count in `CrumbProvider` + `CrumbRecord` is untested (there is no `breadcrumbs.test`). A pure test of the setter's identity, or of `crumbsFor` + tail merging, is acceptable without jsdom.
- `crumbsFor`: no cases for the delivery agent or for agents on `/app/orders/<id>` (finding 1).
- `GroupHub`: no test that it renders only `visibleNav(role)` leaves, redirects when there is a single leaf, or shows the empty state.
- No test that each page title key equals its sidebar `nav.*` key (it would catch finding 3).
- Preview page: no test of the `CrumbRecord` props (the only change was removing the Crumbs mock).

## Not checked live
- Store preview and store pages: the seed has no store.
- Light theme at 1280 px for most hubs, and both themes for the catalog, team and settings hubs.
- Delivery agent screenshots: the redirects were checked, but not screenshotted.
- Contrast: judged by eye only.
