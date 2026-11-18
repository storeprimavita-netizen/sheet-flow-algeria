# NAV-1-F — phone drawer keyboard access + palette search fix
risk: low · surface: ui · lane: shell

Goal: fix the two medium findings and the brand-row lowest finding from `docs/briefs/NAV-1.review-6.md` (D40 follow-up).

## Definition of done
- At < md, with the drawer open, Escape closes it and focus returns to the menu toggle.
- At < md, a closed drawer is `inert` (no Tab stops); at >= md the aside is never inert.
- The open drawer has `role="dialog"` + `aria-modal="true"` + an accessible name; focus moves into it on open.
- ⌘K search no longer matches `n.key` (typing `adSpend` / `financeOverview` finds nothing); page name, old name, group name still match.
- Drawer brand link is >= 44 px at < md (`max-md:min-h-11`).
- `scripts/gate.sh` passes; no new i18n keys (reuse `nav.toggleSidebar` as dialog label), so en/ar parity is untouched.

## Files
1. `src/components/app-shell.tsx`
   - add `drawerRef`, `toggleRef` (on the header Menu button).
   - `useState(isDesktop)` via `matchMedia("(min-width: 768px)")` in a useEffect (listener) so `inert={!open && !isDesktop}` is correct. SSR default: `isDesktop=false`, which makes the aside inert on the server HTML but harmless on desktop after hydration; to avoid a flash use `inert` only when `!open && !isDesktop` and default `isDesktop=true` (no inert on first render, set after mount).
   - on the aside: `inert`, and when `open && !isDesktop`: `role="dialog" aria-modal="true" aria-label={t("nav.toggleSidebar")}`.
   - useEffect on `open`: if true add `keydown` Escape listener -> `setOpen(false)`; focus first focusable in drawer (or the aside with `tabIndex={-1}`); on close, `toggleRef.current?.focus()` (only if it was open before).
   - also close drawer on `isDesktop` becoming true.
   - brand link `brandClass`: add `max-md:min-h-11`.
2. `src/components/command-palette.tsx` line ~97: `value={`${group} ${label}`}`; `key={n.href}` stays (unique per href). Check two leaves never share group+label (cmdk dedupes by value); if they can, append a non-searched suffix is not possible, so add a unit check in nav-model.test.ts.
3. `src/lib/nav-model.test.ts`: add source-level tests in the existing style (the file already greps app-shell): Escape handler present, `inert` present, `role="dialog"`, `min-h-11` on brand, palette value without `n.key`; plus test that visible group+label pairs are unique per role.

## Steps (each committed with scripts/step.sh)
1. palette value fix + uniqueness test.
2. drawer: inert + Escape + dialog role + focus return + brand height + tests.
3. screenshots + PROGRESS note.

## Acceptance tests
- nav-model.test: "palette search value has no i18n key", "group+label unique", "drawer closes on Escape", "drawer inert when closed", "brand row min-h-11".

## Screens to screenshot (browser MCP, per AGENTS.md)
390x844 drawer open/closed, EN dark + AR light (Escape closes, Tab skips closed drawer, focus ring on toggle after close); 1280 sidebar unaffected (not inert) in both themes; ⌘K typing `adSpend` -> empty, `Ad spend` -> found.

## Edge cases / assumptions
- React 19.2 types support the `inert` boolean prop (confirmed in @types/react).
- Radix dropdown in the drawer's user menu portals out; Escape inside it closes only the menu (Radix stops propagation) - do not break that; listen on the aside, not document, or check `defaultPrevented`.
- Resize across md while open: drawer must close.
- Finding 4 (Arabic cmdk fuzzy noise) and finding 5 (K⌘ in RTL, audit secret display) are out of scope: file as follow-ups; no DECISIONS row needed.
- Full focus trap is not added (modal overlay + inert siblings is out of scope); focus move-in and return only. If reviewer insists, make main content `inert` while open.
