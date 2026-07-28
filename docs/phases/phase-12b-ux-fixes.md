# Phase 12b — Navigation, color & map fixes (user feedback after §5)

**Read first:** CLAUDE.md, PROGRESS.md, `docs/TESTING.md` (the permanent
local test account — use it, don't reseed unless told to), `docs/design/
DESIGN_SYSTEM.md`, and the `cod-ui-polish` skill + `references/components.md`
(Navigation, Charts, Map sections — **this phase deliberately overrides two
of that doc's decided defaults**, see §1 and §5 below; update the doc itself
once the override is built, so it stops describing a decision the user has
since reversed).

This phase is real user feedback given after using the merged Phase 12 §5
Dashboard, covering the global shell (sidebar/nav/avatar) and cross-cutting
color/chart conventions — not specific to one section. It goes **before**
Phase 12 §6 (Contacts): building the next section on top of a sidebar that's
invisible in Arabic, or colors that don't read as profit/loss, just compounds
the same fix later. Work on branch `mnw-12b`; merge `--no-ff` into `mnw` when
green, same as every other phase.

## 1. Sidebar broken in Arabic (RTL) — real bug, fix first

`src/components/app-shell.tsx:127-133`. The `<aside>` closed/open transform
is:

```
"fixed inset-y-0 start-0 z-40 flex flex-col ... md:translate-x-0",
collapsed ? "w-16" : "w-64",
open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
```

`-translate-x-full rtl:translate-x-full` has no `max-md:`/mobile scoping, so
at `md:` and above it's still in the class list competing with the
unconditional `md:translate-x-0` on the same `transform` property — whichever
rule lands later in the generated stylesheet wins. In practice, in Arabic
(`dir="rtl"`) at desktop widths this appears to push the sidebar fully
off-screen (`translateX(100%)`), i.e. **invisible whenever the mobile-closed
state and RTL combine, including on desktop** — this is very likely the "sidebar
not showing in Arabic" report.

Fix: scope the open/closed transform to mobile only (`max-md:translate-x-0` /
`max-md:-translate-x-full max-md:rtl:translate-x-full`), so at `md:`+ the
sidebar is unconditionally visible regardless of `open` or direction — mobile
drawer behavior shouldn't be expressible at desktop widths at all. Verify by
screenshotting `/app/dashboard` in Arabic at a desktop width (this is the
exact case that was reportedly broken) and at a mobile width (drawer open +
closed, both directions).

## 2. Avatar menu: fold theme + language + sign-out into it

Currently (`app-shell.tsx:157-193`) the sidebar footer stacks, always
visible: the avatar+email+role row, then three **full-width buttons**
(`<ThemeToggle/>`, `<LocaleSwitcher/>`, `<SignOutButton/>` —
`src/components/theme-toggle.tsx`, `locale-switcher.tsx`,
`src/app/app/dashboard/sign-out-button.tsx`). Requested: clicking the
avatar/user row opens a menu (the repo already has a Radix dropdown
primitive — `src/components/ui/dropdown-menu.tsx`, used elsewhere; reuse it,
don't add a new one) containing theme toggle, language toggle, and sign out.
This directly shortens the sidebar footer from ~4 stacked rows to one row —
feeds into §3.

## 3. Sidebar/nav too tall — needs scrolling to see it all

Two compounding causes, both real:
- `components.md`'s Navigation section currently says "subsections always
  expanded (nothing hidden behind an accordion click)" — with Orders,
  Finance, and Team & Rules all always fully expanded simultaneously, the nav
  is long by design. Revisit this default: collapse to just the parent link
  for sections that aren't the active one, auto-expand only the section
  containing the current page. (This is a deliberate reversal of a phase-11
  decided default — update `components.md`'s Navigation section to describe
  the new behavior once built, so it doesn't keep describing the old one.)
- The footer (§2) currently costs ~4 stacked rows; folding it into one
  avatar-menu row recovers most of that space on its own.
Do the avatar-menu consolidation (§2) first and re-measure before deciding
how aggressively to collapse subsections — it may turn out one of the two
fixes is already enough.

## 4. Move the brand mark out of the sidebar header

`app-shell.tsx:134-153`: the `🛍️` icon + "MNW ERP" + tagline currently sit in
a fixed `h-16` row at the top of the sidebar, alongside the collapse toggle.
Move the brand mark into the top bar instead (the `<header>` around line 201,
which today only has the mobile menu button + ⌘K search), freeing that `h-16`
row's height for nav content. User asked for it "in the top right" — place
it on the trailing/end side of the header using logical props (`ms-auto` /
`justify-end`), not a hardcoded `right-*`, so it lands correctly in both LTR
and RTL rather than literally always-right regardless of language.

## 5. Interactive Algeria map — replace the grid-cartogram SVG

`src/components/dashboard/algeria-map.tsx` (hand-placed 58-cell grid,
built in §5 per `components.md`'s old "inline SVG choropleth only, never a
mapping library" default) reads as a grid of squares, not a map — user
wants a real interactive map. **This overrides that default; update
`components.md`'s Map section afterward to match** (say what you actually
ship — library name, feature set — instead of leaving the old "no mapping
library" line contradicting the code).

Needs an actual Algeria wilaya boundary/GeoJSON, which isn't in the repo —
find or generate one (58 wilayas, simplified geometry is fine, this is a
choropleth, not a routing map) and pick a lightweight library that doesn't
need tile servers/API keys (e.g. `react-simple-maps` or plain `d3-geo` over
an inline SVG rendered from the GeoJSON — both stay dependency-light and
avoid a Leaflet/Mapbox tile dependency + API key this app has no use for
beyond a static choropleth). Keep everything else about the map's behavior:
5-step token color scale on delivery rate, same `confirmedOrders <
min_orders` neutral gate the table's stop-shipping flag uses, hover syncs
with the table both ways, click drills into `/app/orders/all?wilaya_code=`,
stacks below the table on narrow screens. Re-run `algeria-map.test.ts`'s
intent (some self-check that all 58 wilaya codes are present and mapped) —
adapt it to whatever data shape the new library uses.

## 6. Proper semantic colors for profit / investment / loss, and in charts

Money and rate values across the dashboard currently under-use the
success/danger/warning tokens that already exist. Concrete spots to fix:
- `src/components/dashboard/time-chart.tsx`: the invested line is
  `stroke-orange` and net-profit line is `stroke-primary` — switch net
  profit to `stroke-success`/`stroke-danger` by sign (matching the KPI
  tile's own `tone` logic in `page.tsx`), invested to `stroke-danger` (it's
  always a cost, never a positive).
- `src/app/app/dashboard/page.tsx` per-agent and per-product rate tables:
  confirmation/delivery rate cells are plain text with no color coding —
  reuse the same success/warning/danger threshold treatment
  `wilaya-section.tsx`'s `RateBar` already has, instead of a third
  implementation.
- `src/components/stats/funnel.tsx`: every stage bar is the same
  `bg-primary` — consider a per-stage or drop-off-severity color so a bad
  drop-off reads as danger, not just as a number next to a neutral bar.
- `src/components/dashboard/category-bars.tsx`: every bar is flat `bg-info`
  regardless of category — see §8, this should draw from the same
  per-category color set as the vivid dropdowns.
All colors must still come from `globals.css` tokens (`text-success`,
`bg-danger`, etc.) — no hex/rgb literals; this is additive color *usage*,
not a new color system.

## 7. A dedicated place to see status/stage breakdowns as charts

User wants "a part where to see different diagrams of confirmation,
delivery, different status... etc" — i.e., more than the single funnel +
one time-chart currently on Dashboard. This is the largest item here; size
it honestly rather than cramming it into the same session as §1-6:
- **Smaller version** (fits this phase): add 1-2 more charts to the existing
  Dashboard — e.g. confirmation-status breakdown (pie/bars: confirmed vs
  pending vs cancelled) and delivery-status breakdown, following
  `components.md`'s Charts rules (one question per chart, ≤5 series,
  horizontal bars over pie beyond 4 slices).
- **Larger version**: a new `/app/analytics` (or similar) page purely for
  these breakdowns over time, decoupled from the filter-heavy Dashboard.
Default to the smaller version in this phase unless it's clearly too
cramped once you're looking at real seed data — if so, say so and propose
the standalone page as a follow-up phase rather than scope-creeping this one.

## 8. Vivid, distinct colors per option in dropdowns/selects

User wants selects (product/wilaya/source/agent/status filters, category
pickers, etc.) to show vivid, distinct colors per option — green, blue,
yellow, red, violet — rather than uniform neutral `SelectItem` styling.
Route this through the **existing** status/option-color system
(`src/lib/statuses.ts` + `<StatusPill>`, CLAUDE.md: "statuses through one
source, never ad-hoc colored text") rather than inventing a second one —
extend it so each `SelectItem` can show a small color swatch/dot matching
its status/category color, and reuse the same color set for chart series
(ties into §6/§8 wanting category colors in `CategoryBars`). This is
directly relevant to Phase 12 §9 (Option sets, not yet built) — check
whether that section already plans per-option colors before adding a
parallel mechanism here; if it does, pull it forward rather than duplicate it.

## Acceptance criteria

- `docs/TESTING.md`'s account still logs in and shows the same row counts
  after every change here (if not, something broke a query, not the data).
- Sidebar visible and fully usable in Arabic, both desktop and mobile, both
  themes — screenshot it (this was the reported-broken case).
- Avatar click opens a menu with theme/language/sign-out; sidebar footer is
  visibly shorter.
- No native color literals introduced — forbidden-color grep stays at 0.
- `components.md` updated wherever this phase reverses one of its decided
  defaults (Navigation's always-expanded, Map's no-library-ever).
- Screenshot self-critique, both themes, into `docs/design/audit/` per the
  usual rule; note in PROGRESS.md what was shot and fixed.
- `npm run build` + `npm test` green.
