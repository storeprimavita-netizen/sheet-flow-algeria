VERDICT: ESCALATE

## Summary
This is round 4 with no PASS yet, so the rule says escalate. Reviewer: ui-reviewer, with a browser, against the local stack.
Fixed since earlier rounds: model filtering, en/ar parity, tokens/RTL, Lucide icons, live hrefs, and 15/15 tests in nav-model.test.ts.
Three medium findings remain. Medium 2 needs an owner decision: the brief contradicts itself. The Goal and step 2 say "Settings pinned at the bottom", but fix item 5 allows moving Settings inside the scrolling nav, which unpins it.
Not covered: no confirmation_agent login (same code path as delivery_agent). No dark EN, light AR or 390px light screenshots. Tooltips were not hovered.
Screenshots: docs/design/audit/NAV-1/r6-*.png

## Findings

1. **Medium**, src/components/app-shell.tsx:80, 95, 130. `Counter`, `Leaf` and `Group` are components declared inside `AppShell`. Every state change creates new component types, so the whole nav remounts. Seen in the browser: focus a group header, press Enter, and the header node is detached (`isConnected=false`) and focus falls to `<body>`. Keyboard and screen-reader users lose their place on every collapse, and open tooltips reset. **Fix:** hoist them to module scope with props, or call them as plain render functions (`renderLeaf(item)`).

2. **Medium (needs owner decision)**, app-shell.tsx:185 and nav-model.tsx:102. Settings now sits at the end of the scrolling `<nav>` and is collapsed by default. At 1280x720 it is below the fold with no scroll hint. That breaks the Goal ("Settings pinned at the bottom"), even though brief item 5 permitted this layout. **Fix options:**
   - (a) A compact pinned Settings row (or the gear) outside the scroll area, with its children capped at `max-h-[40vh] overflow-y-auto`.
   - (b) Keep it inside the nav, add a bottom fade or scroll affordance, and change the brief's Goal.
   The owner picks.

3. **Medium**, app-shell.tsx:106 (`py-2`, Leaf) and :159 (`py-1.5`, Group header). On the 390px drawer, rows measure 32-36px and group headers 28px, below the 44px touch target. **Fix:** `max-md:min-h-11` on leaves and headers.

4. **Low**, src/components/command-palette.tsx:88. `value={n.href}` makes cmdk match the URL. "app" matches every page, "orders" returns Courier cash, and "Contacts" returns Accounts and Suppliers. **Fix:** set `value` to the label (plus the href for uniqueness) and keep `keywords` for the old names.

5. **Low**, command-palette.tsx. "Overview" (Money) and "General" (Settings) have no group context in the palette, and "General" does not match "Settings". **Fix:** add the group label as a keyword or a prefix ("Money · Overview").

6. **Low**, page titles and tabs. The nav says "Shipping" and "Courier cash", but the page h1, order tabs and dashboard tile still say "Delivery", "Cash" and "Team & Rules". **Fix:** align them, or record in the brief that the rename is nav-only for now.

7. **Low**, app-shell.tsx, rail gear. The tooltip and aria-label read "General" (`settingsOverview`), not "Settings". **Fix:** use `nav.groupSettings`.

8. **Low**, the palette hint shows "⌘K" on non-Mac platforms. Show "Ctrl K" there.

9. **Low**, at 390px in RTL the active bar looks clipped at the nav edge (r6-drawer-390-ar-dark.png).

## Missing tests
- No render or interaction test for AppShell covering:
  - the group holding the active page being forced open
  - persistence of `mnw:nav-groups`
  - focus staying put after a toggle (would catch finding 1)
- The palette keyword test checks strings only, not real cmdk filtering (would not catch finding 4).
- No test that Settings stays reachable or visible, or that the rail renders a single gear.
- No check that a page title matches its nav label (finding 6).
