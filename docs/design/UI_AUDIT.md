# UI Audit — MNW COD ERP (pre-overhaul)

Audited 2026-07-27 against the running app (phases 1–10, branch `mnw`) with the
local Supabase stack seeded (`admin@seed.mnw`). Screenshots in
`docs/design/audit/`. This is the honest state before phases 11–13.

## How this audit was produced

- **Screenshotted with eyes** (Playwright, dark theme — the only theme that
  exists): login, dashboard, orders/all, orders/confirmation, products,
  product pricing, settings, orders/new. Files `00`–`07` in `audit/`.
- **Code-reviewed** (not screenshotted, defects inferred from source):
  delivery queue, cash, contacts (customers/suppliers + details), team
  (rules/meetings/performance/audit), product expenses/stock/statistics
  tabs. They reuse the same primitives audited below, so the same defects
  apply.
- Light theme was **not** screenshotted because it does not exist (see G1).

## Headline: the app is better-built than the brief assumed

The brief anticipated a GLM mess with hardcoded colors and white-on-white
everywhere. Reality is different and it changes the phase-11 plan:

- **Colors are already tokenized.** One hardcoded color in the entire
  `src` tree (`bg-black/50` scrim, `app-shell.tsx:130`). Everything else reads
  CSS variables. The token *layer* exists (`globals.css`) and is OKLCH-based.
- So the overhaul is **not** a de-hardcoding rescue. It is: (1) add the missing
  light theme, (2) replace decoration with legibility, (3) build the status +
  field + table component systems that don't exist yet, (4) fix the native
  dropdowns, (5) realign a few sections to the decided defaults.

The real problems are structural gaps, not color bugs.

---

## Global defects (every screen)

**G1 — Light theme does not exist.** `globals.css` defines `:root` (dark) and
`.dark` (a duplicate of dark). There is **no `.light` block** (`grep -c
'\.light'` → 0). Settings has no theme switch. The brief requires a complete,
equally-correct light theme as a Settings option. This is net-new, not a patch.

**G2 — The dropdown bug's real cause is the native `<select>`.**
`components/ui/select.tsx` is a styled **native `<select>`** (`bg-transparent`).
Its option list is rendered by the OS, so it (a) ignores our tokens — the
"white text on white" the brief flagged is the OS popup on a dark app, (b)
cannot show a status pill or a color chip inside an option, (c) can't do
type-to-filter or inline "+ Create". Used in **20 files**. Every status
select, wilaya select, category select, currency select inherits all three
problems. Fix = a Radix/shadcn `Select` + `Combobox` wired to `--surface-raised`.

**G3 — No status system.** There is no `lib/statuses.ts` and no `StatusPill`.
Statuses render as `Badge` solid fills: `Confirmed` = saturated green,
`Returned` = saturated red, `Wait for confirmation` = grey (see `02`, `03`).
This is the exact anti-pattern the brief names — "saturated fill with white
text at 12px", no dot, no icon, no shared source of truth. Colors, labels,
and allowed transitions are scattered per-component.

**G4 — No field components.** No `components/fields/`. Raw `<input>` appears in
9 feature files; the `Input` primitive (plain text box) in 26. Consequences seen
on `07-order-new`: phone is a plain textbox (no Algerian mask, no dup hint),
money is a plain number box (no `DA` suffix, no thousands separators, no
tabular alignment, spinner arrows), quantity is a number box (no stepper),
wilaya is a native select (not a searchable 58-wilaya combobox), commune is a
free-text "City" box (not dependent on wilaya). Money is not tabular anywhere.

**G5 — Decoration over legibility.** `glass-card` (blurred gradient panel) is
used **59 times** — effectively every Card. Plus a fixed radial-gradient body
background, `text-gradient` brand text (6×), gradient avatars. The brief
explicitly says spend the boldness on making *state* legible, not on
decoration; and blur/gradients hurt contrast and scannability in an
8-hour-a-day data tool. Strip to flat tokened surfaces with borders for
elevation.

**G6 — Navigation is collapsed to 6 top-level items; subsections are hidden.**
`app-shell.tsx` renders exactly six links (Dashboard, Orders, Products,
Contacts, Team, Settings). The brief requires **always-expanded subsections**
(Orders → All/Confirmation/Delivery, Finance → Overview/Expenses/Ad spend/
Income, Contacts → Customers/Suppliers, Team → Rules/Meetings/Tasks/
Performance/Users/Audit log). Also missing: a **Finance section entirely**
(there is no `/app/finance` route — finance lives scattered in Orders "Cash"
and Product tabs), live action counters, ⌘K palette, collapsible icon-rail,
breadcrumbs.

**G7 — Native date inputs, US format.** Filter bars use `<input type="date">`
showing `mm/dd/yyyy` (see `01`, `02`). No date-range preset component beyond
three buttons; no "This month / Last month / Custom".

**G8 — No four-state discipline.** Lists/cards/charts don't have designed
loading (skeleton), empty (with action), error (retry) states — content or
blank. No toast/undo/optimistic pattern is standardized.

---

## Per-screen findings

### Login — `00-login.png`
- Fine as a baseline. Emoji logo 🛍️, gradient-tinted card. Locale toggle works.
- Minor: no error affordance shown; heading uses default weight.

### Dashboard — `01-dashboard.png`
- **Ad-spend quick entry is embedded inline at the bottom of the dashboard
  page** — the brief calls this out by name as the thing NOT to do ("must never
  be an awkward inline widget in a chart area"). It should be a 4-field modal
  from a Quick-actions row, and also live on the product page.
- **KPI cards**: no sparkline, no delta-vs-previous-period, not clickable to
  filter. Net profit `-195,178 DZD` renders in plain foreground, not red —
  money isn't color-coded or tabular.
- **Funnel**: all four bars the same green; drop-off is text only. No visual
  weight to the drop.
- **Per-wilaya**: table with in-cell rate bars is good, but there is **no
  inline-SVG choropleth of Algeria beside it** (decided requirement). "Manual
  flag / Auto flag" columns are `—` placeholders.
- **Spending by category**: plain label→value text list, no chart, no category
  icons.
- Filter bar: native selects (G2), native dates (G7), no chips for active
  filters, not URL-shareable in a visible way.
- Copy: "Welcome back. Here's what's being built." is placeholder text.

### Orders — All — `02-orders-all.png`
- Statuses are solid-fill `Badge`s (G3). No icons/dots.
- Missing columns the brief specifies: product **thumbnail**, **qty**,
  **delivery fee**, **source badge** (Shopify/LightFunnels/Manual), **agent**.
- **Duplicate rows not flagged**: `SEED-DUP-1/2` are literal duplicates but
  carry no `copy-warning` chip and there's no "Duplicates only" filter.
- No bulk selection / floating action bar, no column-visibility menu, no
  density toggle, no sticky header/first column, no visible pagination.
- Row click navigates to a full page (`/orders/[id]`) instead of opening a
  **detail sheet** over the list.

### Orders — Confirmation — `03-confirmation.png`
- **Wrong pattern**: renders as a stack of expanded edit **cards**, one per
  order. The decided default is a **table list; click a row → detail sheet**.
- Phone `0550000019` is plain text — **not a `tel:` click-to-call link**.
- Risk shows as `Risk: 75` solid-red / `Risk: 25` solid-green fill — no shield
  icon, no green/amber/red pill grammar; the reason is dumped inline as "Total:
  2 · Returned: 1 · Cancelled: 1" rather than on hover.
- Status is a native `<select>` (G2) with no pill in trigger/options.
- No customer previous-orders list, no "Save & open next", no ↑/↓ row nav.

### Products — `04-products.png`
- **Wrong default**: renders as a **table**. Decided default is a **grid of
  image cards**, table as secondary toggle.
- Status is a per-row native `<select>` + a per-row "Save" link — clunky; should
  be a pill select with optimistic save.
- Cards/rows lack: image (grey placeholder — products have no images and there's
  no uploader), delivery rate, net-profit (color-coded), 30-day sparkline, kebab.

### Product → Pricing — `05-product-pricing.png`
- **"Real" column is missing.** Shows Best/Medium/Worst only; the brief requires
  a 4th read-only **Real** column computed from live data.
- Profit/Loss chips are saturated fills (G3). Net-profit figures *are*
  color-coded green/red (good, keep).
- Inputs (Euro price, Cost/lead €) are plain number boxes — no Money/Percent
  field, no `%`/currency suffix, no live "≈ … DA at rate" conversion line.
- No **break-even indicator** (min delivery rate for profit).
- No product-context header on the tab (no product name/image/status pill;
  no breadcrumb). Tab bar is fine.

### Settings — `06-settings.png`
- One long scroll of sections, no grouped cards with a section nav/anchors.
- Wilaya fee table: plain number inputs, native currency selects, and a single
  bottom "Save"; fixed-fees uses **per-row Save + red Delete inline** (destructive
  not separated). Bulk-paste for the 58-wilaya table is absent.
- Money inputs are plain (G4). No theme/appearance controls (ties to G1).

### Order — New (representative form) — `07-order-new.png`
- Every field is a raw control (G4): native product select, native wilaya
  select, plain phone, plain unit-price/delivery-fee number boxes, plain
  quantity, free-text "City".
- Primary "Save" sits **bottom-left**; form rule is primary bottom-right,
  cancel left. No dirty-state save bar, no ⌘/Ctrl+Enter, no inline validation.

---

## Hardcoded-color inventory

Full `grep -rnE 'text-white|bg-white|text-black|bg-black|#[0-9a-fA-F]{3,6}|rgb'`
over `src` (excluding `globals.css`):

| File:line | Violation | Fix |
|---|---|---|
| `src/components/app-shell.tsx:130` | `bg-black/50` mobile scrim | `bg-[--overlay]` token (add `--overlay` = black/50 both themes) |

That's the whole list. The color discipline is already good; keep it that way
by adding the missing tokens (semantic tint/fg pairs, `--surface-raised`,
`--overlay`, light theme) rather than hunting hex.

---

## What to reuse (don't rebuild)

- The OKLCH token architecture and Tailwind `@theme inline` mapping in
  `globals.css` — extend it, don't replace it.
- `format.ts` money/date formatting, `pricing.ts` math, the per-wilaya table
  with in-cell bars, the dashboard aggregate RPC, the pricing 3-scenario layout.
- `PageHeader`, `Field`, `Card`, `Button`, `Badge` primitives — restyle in
  place (Badge becomes the base for StatusPill; Card loses `glass-card`).

## Priority order for phases 11–13

1. **Tokens + light theme + de-decoration** (G1, G5, G8 scaffolding) — the base.
2. **Status system** (G3) — highest information value in a COD tool.
3. **Radix Select/Combobox + field components** (G2, G4) — kills the dropdown
   bug and the raw-input sprawl.
4. **Navigation rebuild** (G6) — expanded subsections, Finance section, ⌘K.
5. **Section realignment** to decided defaults: products→card grid,
   confirmation→table+sheet, pricing→add Real column, dashboard→map + KPI
   drill-through + ad-spend as modal, settings→grouped cards.
6. **Four-state + interconnection + a11y sweep** (G7, G8).
