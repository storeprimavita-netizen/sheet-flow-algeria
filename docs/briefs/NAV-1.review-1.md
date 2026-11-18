VERDICT: FIX

## Summary
Model, role filtering, hrefs, empty-group drop, persisted collapse, forced-open active group, rail separators and tokens all match the brief.
One medium: duplicate cmdk `value` ("Overview" twice) breaks palette selection for admins.
Four lows (a11y of disabled toggle, no active item on /app/orders/new|[id], duplicate icon, dead keys).
Code-only review: the ui-reviewer did not run the app (no screenshots, no vitest run). The builder must still do the screenshot self-critique.

## Findings

1. MEDIUM — `src/components/command-palette.tsx:88` with `src/messages/en.json:11,27` (`nav.financeOverview`, `nav.settingsOverview` = "Overview"; the ar labels are the same too).
   Failure: cmdk uses `value` as the item identity. Both leaves get `value="Overview"`, so they highlight together and Enter can go to the wrong page (Finance instead of Settings).
   Fix: make the value unique, e.g. `value={n.href}`, and put the label (plus the group name) in `keywords`. Or give the two labels distinct text ("Finance overview" / "Settings overview").

2. LOW — `src/components/app-shell.tsx:145-146`. The toggle for the active group is `disabled`. That takes it out of the tab order and makes `aria-expanded` inert. Its `aria-label` also overrides the visible text, so the group counter is not announced.
   Fix: use `aria-disabled` with a no-op click, and drop the `aria-label` (or include the count in it).

3. LOW — `src/components/nav-model.tsx:130-134` (`activeLeafHref`). With leaf-only prefix matching, `/app/orders/new` and `/app/orders/[id]` light no item and force no group open. Before, the Orders section matched them.
   Fix: give Sell / All orders an extra match prefix `/app/orders`, which longest-prefix still overrides for confirmation, delivery and cash.

4. LOW — `src/components/nav-model.tsx`. `income` and `courierCash` both use the Banknote icon, so they cannot be told apart in the icon rail.
   Fix: use a different Lucide icon for one of them.

5. LOW — `src/messages/{en,ar}.json`. The old `nav.orders`, `nav.finance`, `nav.team`, `nav.contacts`, `nav.users`, `nav.delivery`, `nav.cash` and `navOld.team` may now be unused.
   Fix: grep for usages (`orders/[id]/page.tsx` uses at least one `nav.*` key) and prune the dead ones.

## Missing tests
- Admin `navLeaves`: labels and palette values are unique. This test would have caught finding 1.
- `activeLeafHref`: `/app/contacts/suppliers` does not light Customers, `/app/products/planner` does not light Products, nested paths (`/app/orders/123`) resolve.
- Every `oldKey` resolves under `navOld` in en and ar.
- The persisted-collapse parser tolerates a corrupt `localStorage` value.
