VERDICT: PASS

## Summary
Round 3 (ui-reviewer, judged on the live app at localhost:3000, screenshots in `docs/design/audit/NAV-2/r4-*`).
All 3 review-2 mediums are resolved on screen: the agent crumb "… › Confirmation › #0066" links back to the queue, the /app/sell hub cards show 18 and 8 (matching the sidebar), and the team and supplier titles match the sidebar labels. Review-2 #7 (crumb loop) is also resolved.
Still open, all low: review-2 #4 (not re-checked), #6 and #8, plus new lows A to C below. There are no high or medium findings.
Coverage gap: this round did not re-screenshot the full light/dark × EN/AR × 1280/390 matrix. The admin record crumbs and 390 px truncation rest on the nav-model tests and on rounds 1 and 2.

## Findings

1. **LOW: the agent order detail shows a misleading purpose line.** Code: `src/app/(app)/app/orders/[id]/page.tsx:153-168`, which falls back to `navPurpose.all` ("Every order, with filters, search and history").
   - Seen: the confirmation agent cannot open All orders, yet the order page tells them it is "every order" (`r4-agent-order.png`).
   - Fix: use the purpose key of the role's own queue leaf, or a neutral "Order details" string.

2. **LOW (review-2 #8, still open): the delivery agent hits a bare not-found state.** Code: `src/app/(app)/app/orders/[id]/page.tsx:46`.
   - Seen: the title reads "All orders" (a page this agent cannot open). There is no crumb and no link back to Shipping.
   - Fix: use the role's queue title, and add a ButtonLink back to the role's queue.

3. **LOW (review-2 #6, still open): the related links duplicate the finance tabs.** Code: `src/app/(app)/app/finance/expenses/page.tsx:48`.
   - Seen: "Ad spend / Accounts" sits directly above tabs that already link to both pages.
   - Fix: drop `related` on the finance pages that have tabs, or point it at pages outside the tab set.

4. **LOW (review-2 #4, not re-checked): the record name may be unreadable at 390 px.** Seen in round 2 on `/app/products/<id>/pricing` in AR light.
   - Fix: re-screenshot that page and apply truncation with a `title` attribute if the name is still clipped.

5. **LOW: the crumb collapse hides the only group context on small screens.** Code: `src/components/breadcrumbs.tsx:69`.
   - Seen: at 500 px the Sell crumb becomes "…" even though only three short parts are shown. This matches the brief ("group collapses to …").
   - Fix: optionally collapse only when there are 4 or more parts, or when the crumb row actually overflows.

6. **LOW, not a NAV-2 regression: the agent's "Show closed" button sits on its own row.** On mobile this pushes the queue table down (`r4-agent-sell.png`). Note it for a later UI pass.

## Missing tests
- A `crumbsFor` or page-level case for the delivery agent's not-found order state that offers a back link (finding 2).
- `GroupHub`: the rendered leaf set per role, the single-leaf redirect, and the counts shown on the cards.
- A parity test that each page's title key equals its sidebar `nav.*` key, so review-2 #3 cannot regress.
- A regression test for the CrumbProvider stable setter (the round 1 render loop).
