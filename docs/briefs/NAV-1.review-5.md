VERDICT: ESCALATE

## Summary
Fifth diff review (n = 5 >= 3 with no PASS, so the rule forces ESCALATE). Reviewer: ui-reviewer, which ran the app (admin, dark, EN, 1280x720) and read the code.
What works: the nav model matches the brief (agents see only Sell, the empty Store group is hidden, longest-prefix match is in place), the D32 pinned Settings row lights up on /app/settings/audit, counters show, and ⌘K "Cash" finds Courier cash.
Two medium UI findings are still open. The first is the review-4 sidebar overflow, which D32 only partly fixed. The owner must decide: fix it, or accept it as is.
The reviewer did not check light theme, AR/RTL, the icon rail, the 390px drawer or the agent logins in the browser.

## Findings (ranked)

1. **MEDIUM**: `src/components/app-shell.tsx:209` (`<nav className="flex-1 space-y-3 overflow-y-auto p-3">`).
   - Failure: at 1280x720, admin, the list cuts off at Money > Expenses. Ad spend, Courier cash, Income, Suppliers and the whole Team group are below the fold, and nothing shows that more items exist: no fade, no shadow, no visible scrollbar. Evidence: `docs/design/audit/NAV-1/rv-audit-1280.png`.
   - Fix (pick one): a bottom fade or scroll shadow on the scroll container; tighter spacing (`space-y-3` plus `py-1.5` headers); or close some groups by default on short viewports.
   - Owner call needed: which fix, or accept it as is.

2. **MEDIUM**: `src/components/app-shell.tsx:118` and `:133`.
   - Failure: the header of the group holding the active page has `aria-disabled` and an `invisible` chevron. It is still a focusable button with `aria-expanded=true` and still changes colour on hover, so it looks inert but still acts like a button for mouse, keyboard and screen readers.
   - Fix: render a non-interactive label (`<div>`) when `hasActive`, or drop the hover and focus affordance in that state.

3. **LOW**: `src/components/command-palette.tsx:97`.
   - Failure: `value` includes `n.href`, so typing "orders", "contacts" or "team" matches on the URL instead of the label. This adds noise for Arabic or label-based search. `keywords` also repeats the label and group.
   - Fix: keep `value` unique without the href (use the key or id).

4. **LOW**: `src/components/app-shell.tsx:169-170`.
   - Failure: closed groups are read from localStorage inside an effect, so a closed group flashes open on first paint. This is accepted to avoid a hydration mismatch.
   - Optional fix: hide the group bodies until hydrated.

5. **LOW**: the collapsed group header shows a counter sum with no accessible name.
   - Fix: add an `aria-label`, for example "Sell, 26 pending".

6. **LOW**: `visibleNav(null)` returns an empty list, but the brand link still falls back to `/app`, which may redirect to a page the user can't open.

## Missing tests
- Every nav href maps to an existing `src/app/app/**/page.tsx` (brief: "every href is a CURRENT url").
- ⌘K: "Delivery" and "Shipping" return the same item; "Cash" returns Courier cash; "Contacts" returns Customers.
- Render test for the counter sum on a collapsed group header.
- Screenshot/Playwright check at 1280x720 that a clipped list shows a scroll affordance (finding 1).
- Not verified in the browser by this review: light theme, AR/RTL, the collapsed icon rail and its tooltips, the 390px drawer, and the confirmation_agent and delivery_agent sessions.
