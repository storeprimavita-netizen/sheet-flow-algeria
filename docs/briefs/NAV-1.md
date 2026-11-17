# NAV-1 — Sidebar: five job-named groups + Home + Settings
risk: low · surface: ui · lane: shell

Goal: the sidebar shows Home, job-named groups (always visible, collapsible, persisted) and Settings pinned at the bottom, labels en/ar, and ⌘K finds every page by new and old name. No route moves, no behaviour change.

## Definition of done
- Sidebar renders Home · Sell · Catalog · Store · Money · Team · Settings(bottom); group labels are visible text, items have Lucide icon + label.
- No accordion hiding siblings: all groups open by default; user can collapse a group; choice persists (localStorage `mnw:nav-groups`); group with the active page is forced open.
- Icon rail (collapsed) keeps a separator between groups and tooltips with labels.
- `visibleNav(role)` filters by role; agents never see an admin-only link (same pages as today).
- ⌘K lists every visible page under new label, matching old label too (cmdk `keywords`).
- Every hrefs is a CURRENT url that exists. Counters (confirmation, shipping, tasks) still work.
- en/ar `nav.*` parity; gate green.

## Findings (real code, 2026-11-17)
- `nav-model.tsx` (121 lines): NAV = flat sections with `children`; `visibleNav` returns only Orders for agents (confirmation_agent → Confirmation, delivery_agent → Delivery). Agents have no Home today; keep that (My day = NAV-5).
- Only consumers: `app-shell.tsx` (accordion w/ `expanded` state, longest-prefix active match) and `command-palette.tsx` (flattens leaves).
- Existing routes under `/app`: dashboard, orders/{all,confirmation,delivery,cash,new,[id]}, products(+planner,[id]), stock, finance/{overview,expenses,ad-spend,income,accounts}, contacts(+suppliers), team/{rules,meetings,tasks,performance}, settings/{users,audit}.
- NOT existing yet: Abandoned checkouts, Research, Store pages/forms/discounts/tracking/store settings, Integrations, Delivery fees, Options, Workspace. Do not add dead links (would 404): omit them; they join their group when their task ships. Store group has zero items now, so hide empty groups (render nothing) — it appears with STORE-*.
- Assumption (no DECISIONS row needed, D16 covers): keep Customers/Suppliers/Team admin-only as today.

## Model (nav-model.tsx)
Replace `NAV` with `NavGroup = { key; items: NavLeaf[]; pinned?: "bottom" }` plus `home` leaf. `NavLeaf` gains `oldKey?` (i18n key under `navOld.*`) . Mapping:
- Home: `/app/dashboard` (admin).
- Sell: Confirmation `/app/orders/confirmation` (counter), Shipping `/app/orders/delivery` (counter; old "Delivery"), All orders `/app/orders/all` (admin), Customers `/app/contacts` (admin; old "Contacts").
- Catalog: Products `/app/products`, Stock `/app/stock`, Pricing calculator `/app/products/planner` (admin).
- Money (admin): Overview `/app/finance/overview`, Accounts, Expenses, Ad spend, Courier cash `/app/orders/cash` (old "Cash"), Income `/app/finance/income`, Suppliers `/app/contacts/suppliers`.
- Team: Tasks (counter), Meetings, Rules, Performance (admin; old group "Team & Rules").
- Settings (bottom, admin): Users & roles `/app/settings/users`, Audit log `/app/settings/audit`, Overview `/app/settings`.
Active match: longest href prefix; `/app/contacts/suppliers` must not also light Customers (already handled by longest-prefix). Add `export function navLeaves(role)` used by palette.

## Steps (each committed with scripts/step.sh)
1. `nav-model.tsx` new model + `visibleNav` + `navLeaves`; messages en/ar: `nav.groupSell/Catalog/Store/Money/Team/Home/Settings`, `nav.shipping`, `nav.courierCash`, `nav.pricing`, `nav.usersRoles`, `navOld.*` (en+ar).
2. `app-shell.tsx`: render groups with label headers + collapse toggle (aria-expanded, chevron rtl-aware), persisted; settings pinned above the user block; rail separators/tooltips. Logical props only, tokens only.
3. `command-palette.tsx`: use `navLeaves`, `keywords={[old label]}`; keep quick actions and customer search.
4. Pure test `src/lib/nav-model.test.ts` (move logic to testable .ts if the .tsx imports block vitest; else test the .tsx).

## Acceptance tests
- `nav-model.test.ts`: agent roles contain no adminOnly leaf; confirmation_agent sees only Confirmation, delivery_agent only Shipping (as today); admin sees every group with items; empty groups dropped; all hrefs unique; every `nav.*`/`navOld.*` key exists in en and ar.
- Gate (`scripts/gate.sh`): parity + color lint.
- Palette: typing "Delivery" and "Shipping" both find the same item (manual / screenshot).

## Screenshots (ui-reviewer, both themes, AR + EN, 1280 and 390 px)
Admin on /app/dashboard and /app/orders/confirmation (expanded, one group collapsed, rail collapsed); agent session; ⌘K open searching "Cash"; mobile drawer open. Check chevron/RTL, active bar, counters, contrast.

## Edge cases
- Persisted collapse state read in useEffect (avoid hydration mismatch).
- Counters on collapsed group header show the sum (as today).
- No role (`null`): show nothing.
- No new DECISIONS row needed.
