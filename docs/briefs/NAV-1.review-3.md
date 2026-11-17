VERDICT: ESCALATE

## Summary
Third diff review of NAV-1 (ui-reviewer, app run in admin EN + AR, dark, 1280x720). The grouped model, the hidden empty Store group, counters, RTL, the pinned Settings and its persistence all work.
One MEDIUM remains: when Settings is open, it squeezes the scrolling nav and clips the Money group. The rule is n >= 3 without PASS, so this escalates to the owner. No product decision is needed: the fix is a small layout change.
Not covered this round: light theme, 390 px drawer, icon rail, agent sessions, interactive ⌘K, keyboard/focus.

## Findings (ranked)

1. **MEDIUM**, `src/components/app-shell.tsx:170-177`
   - Failure: the bottom Settings block sits outside the scrolling `<nav className="flex-1 ... overflow-y-auto">`. With Settings expanded (header + 3 items), the main nav at 1280x720 shrinks to ~418 px for ~904 px of content. Only Home, Sell, Catalog and part of Money are visible, and Money is cut mid-row (screenshot `docs/design/audit/NAV-1/review-admin-ar.png`).
   - Fix (pick one):
     - Cap the bottom block with `max-h-[40vh] overflow-y-auto`.
     - Or render Settings as a single leaf to `/app/settings` (its page already links Users/Audit).
     - Or move Settings inside the scrolling nav, at its end.

2. **LOW**, `src/components/nav-model.tsx:104`
   - Failure: `usersRoles` uses the `Users` icon, the same one as `customers` (line 66), so two items share one icon. The "General" overview, which is the group's index page, is listed last.
   - Fix: use `UserCog` or `ShieldCheck` for Users & roles, and put the overview first.

3. **LOW**, `src/components/app-shell.tsx` (`Group`, active header)
   - Failure: the group holding the active page has an `aria-disabled` header but still shows its chevron, so it looks clickable and does nothing.
   - Fix: hide or dim the chevron when `hasActive`.

4. **LOW**, `src/components/app-shell.tsx` (`Group`, rail branch)
   - Failure: in the icon rail, Settings adds 3 icons separated only by a border, so it no longer reads as pinned apart.
   - Fix (optional): show a single gear icon for Settings in the rail.

## Missing tests
- No render test for `AppShell`: forced-open active group, collapse persistence round-trip, rail separators, aria attributes.
- No palette test: "Delivery" and "Shipping" should resolve to the same item, and "Cash" should find Courier cash (keywords).
- No test that the counter sum shows on a collapsed group header.
- No test that every nav href maps to an existing `src/app/app/**/page.tsx`.
- The agent `visibleNav` test asserts keys but not group structure (e.g. Sell is the only group for agents).

## Owner decision
None on product. The escalation comes only from the review-count rule (third round without PASS). Finding 1 is a layout fix within D16. Suggested route: apply fix 1 (and optionally fixes 2-3), then run one more ui review that covers the unchecked matrix.
