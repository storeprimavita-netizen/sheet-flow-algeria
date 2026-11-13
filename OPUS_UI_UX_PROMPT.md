# PROMPT #2 — DESIGN SYSTEM & UI/UX OVERHAUL
# Pair this with OPUS_MASTER_PROMPT.md (functional spec). This file governs HOW everything looks and feels.
# Opus 5 = architect. Plan and produce design docs + phase files. Sonnet executes.
#
# TIMING: this overhaul runs AFTER the 10 functional phases are done (as phases 11–13).
# The rules in this file are also packaged as an installable skill (`cod-ui-polish`) that
# lives in .claude/skills/ and auto-triggers on any UI work. Install it before phase 11.

## THE PROBLEM YOU ARE SOLVING

The existing app (built by GLM) has correct-ish features but unusable interface craft:

- Inputs are wrong for their data type (free-text where a searchable select belongs, ad-spend entry buried in the dashboard, no currency/phone/date affordances).
- **Broken theming: dropdowns render white text on white background.** Components don't inherit tokens; some use hardcoded colors.
- Statuses are plain text — no color, no icon, no visual weight. In a COD dashboard status IS the primary information.
- Charts are decorative and unreadable; wrong chart types, no empty/loading states.
- Zero icon language, no labels/badges/chips, no visual hierarchy.
- Navigation buries subsections; nothing is one click away.

A previous version built with Lovable had better UI. **Match or beat that bar.** The goal is an ERP that a non-technical Algerian ecommerce team can operate at speed, all day, without confusion.

---

## DECISIONS ALREADY MADE BY THE USER (do not re-ask, do not "improve")

1. **Dark theme is the default.** Light theme exists as an option in Settings and must be equally correct.
2. **Confirmation workflow = table list, click a row to open the detail sheet.** No dedicated call-mode screen.
3. **Delivery view = dense table by default**, kanban as an optional toggle.
4. **Products list = grid of image cards by default**, dense table as a secondary toggle.
5. **Dashboard per-wilaya = table with in-cell rate bars beside a small inline-SVG choropleth of Algeria** (table is the source of truth, map is for pattern-spotting; hover syncs both ways, click filters).
6. **Tasks page = kanban board by status by default** (Todo / Doing / Blocked / Done), list as a secondary toggle.

---

## STEP 0 — AUDIT WITH YOUR EYES, NOT ONLY THE CODE

Before designing:

1. Run the app locally. Use a browser automation MCP (Playwright or Chrome DevTools MCP — see TOOLING) to **screenshot every page and every open dropdown/modal**. Save to `docs/design/audit/`.
2. Write `docs/design/UI_AUDIT.md`: per screen — what's broken (contrast, wrong control, missing state, dead space, inconsistent spacing), with the screenshot referenced. Be blunt and specific ("Select trigger uses `bg-background` with `text-background`" not "styling issues").
3. Grep for hardcoded colors (`#`, `rgb(`, `text-white`, `bg-white`) and list every violation. These all get replaced by tokens.

---

## STEP 1 — DESIGN DIRECTION (get user approval before building)

Produce `docs/design/DESIGN_SYSTEM.md` containing a **token system**, then present 2 directions to the user with a rendered preview page (`/design-preview` route showing all components in both themes) and let them pick before any refactor.

Requirements for the token system:

- **Palette: 6–8 named hex values** — surface, surface-raised, border, text-primary, text-muted, brand/primary, plus semantic scales. **DARK IS THE DEFAULT THEME** (the team works in the app all day) — design dark first and make it excellent, then derive a correct light theme as a secondary option in Settings. Both themes must be complete; every component reads from CSS variables (`--surface`, `--text`, `--border`...) — **no hardcoded colors anywhere, ever**. A dropdown must be readable in both themes as a structural guarantee, not a patch.
- Dark-theme specifics: avoid pure black (use a deep neutral surface) and avoid pure white text (slightly dimmed for long sessions); elevation is conveyed by lighter surfaces and borders, not heavy shadows; status colors need higher lightness/lower saturation than their light-theme versions to keep 4.5:1 contrast on dark surfaces — define both variants explicitly in the tokens.
- **Typography**: one display/UI face + one **tabular-numeral** face for all money and metrics (numbers must align in columns — use `font-variant-numeric: tabular-nums`). Define a type scale (12/14/16/20/24/32) with weights. Arabic/French accented characters must render correctly.
- **Density**: this is a data tool — compact by default. Define spacing scale (4/8/12/16/24/32), row height (~44px, comfortable/compact toggle), radius (one value, applied consistently), and one subtle elevation for popovers/modals only.
- **Signature**: one memorable, functional element — suggestion: the **status pill system** (colored dot + label + optional icon) used identically everywhere, plus a per-order **stage progress rail** showing where the order sits in the funnel. Don't spend boldness on decoration; spend it on making state legible at a glance.
- Avoid generic-AI defaults (cream + terracotta serif, black + acid green, newspaper hairlines). Pick something appropriate to a logistics/finance tool: confident, quiet, high-contrast, fast to scan.

**Implementation basis**: use shadcn/ui components (Radix under the hood) wired to the tokens, Tailwind for layout, `lucide-react` for icons, `recharts` for charts. Every shadcn component must be installed and themed centrally — no one-off styled divs pretending to be selects.

---

## STEP 2 — STATUS COLOR SYSTEM (non-negotiable, applied app-wide)

Every status renders as a **pill: colored dot + icon + label**, same component everywhere (table cell, detail page, dropdown option, filter chip). Colors must pass 4.5:1 contrast on both themes (use a tinted background + strong foreground, never a saturated fill with white text at 12px).

**Confirmation statuses**
| Status | Color family | Icon (lucide) |
|---|---|---|
| Wait for confirmation | slate / neutral | `clock` |
| No answer | amber | `phone-missed` |
| Closed phone | orange | `phone-off` |
| Cancelled | red | `x-circle` |
| Confirmed | green | `check-circle-2` |

**Delivery statuses**
| Status | Color family | Icon |
|---|---|---|
| Wait for deposit | slate | `package` |
| Bureau deposited | blue | `building-2` |
| In transit | indigo | `truck` |
| Out for delivery | cyan | `navigation` |
| Stop desk waiting | violet | `map-pin` |
| Delivered | green | `check-check` |
| Delayed | amber | `clock-alert` |
| Cancelled | red | `x-circle` |
| Returning | orange | `corner-up-left` |
| Returned | rose/dark red | `undo-2` |

**Product statuses**: to be tested (slate, `flask-conical`) · tested (blue, `beaker`) · confirmed (green, `badge-check`) · cancelled (red, `ban`).

Rules: one source of truth (`lib/statuses.ts`) exporting label, color token, icon, and allowed transitions. Status selects show the pill **inside the trigger and inside every option**. Changing a status shows a confirm step only for destructive/irreversible ones (cancelled, returned), otherwise instant with optimistic UI + toast + undo where safe.

---

## STEP 2.5 — OPTION SETS (Notion-style dropdowns) AND INTERCONNECTION

Two requirements that shape everything after them.

**(a) User-extensible dropdowns.** Taxonomy fields ship with defaults and let any user add a new option inline: type to filter, and when nothing matches the last row is `+ Create "atelier broderie"` — one click creates, colors, and selects it without leaving the form. Applies to: supplier/atelier type, product category, tissu, expense subcategory, order tags, cancellation reason, customer tags. New options get an auto-assigned color from the chip palette, changeable after. Options render as chips identically in the trigger, in every option row, in tables, and in filter chips. Admins can rename (propagates everywhere, since rows store the option **id**), recolor, reorder, archive (never hard-delete — archived options still render on old records, greyed), and **merge** two options. Manage them in Settings → Options; inline creation stays the primary path. **System statuses are the exception**: fixed keys, editable labels and colors only.

**(b) Interconnection — one app, not a folder of tabs.**
- One record, many entry points, one component: an expense added from a product page and one added from Finance → Expenses use the same form and produce the same row; context only pre-fills.
- Every number drills through: KPI cards, chart segments, wilaya rows, agent rates, category totals all navigate to the filtered records behind them, with filters shown as chips and encoded in the URL so a view can be shared.
- Every detail view shows its relations with counts and "View all": product → orders, expenses, ad spend, suppliers, tasks · customer → orders and the history behind their risk score · supplier → expenses with a running total · order → customer, product, status timeline · meeting → objectives, decisions, tasks · task → its meeting.
- Detail views open as sheets over the current list (max two deep) and are URL-addressable.
- Money flows one way, automatically: delivered orders become product revenue, returned orders book the return fee as an expense, ad spend attributes to its product everywhere at once, fixed fees allocate by delivered-order share with the method stated in the UI, and the pricing calculator's Real column is a view over all of it — never a copy.
- ⌘K palette searches every entity and creates records with the current page as context.

## STEP 3 — INPUT INVENTORY (right control for every data type)

Build these once in `components/ui/` (or `components/fields/`) and use them everywhere. No raw `<input>` in feature code.

| Data | Control |
|---|---|
| Money (DZD) | Numeric field, right-aligned, tabular numerals, thousands separators live, suffix `DA`, no spinner arrows, accepts paste with spaces |
| Money in USD/EUR | Same + currency toggle chip; shows live DZD conversion under the field using the Settings rate ("≈ 268 400 DA at 268.4") |
| Percentage | Numeric with `%` suffix, 0–100 clamp, optional slider companion in the pricing calculator |
| Phone | Masked Algerian input, normalizes 0X / +213 / spaces to one canonical value, shows a duplicate-customer hint inline if the number already exists |
| Wilaya | Searchable combobox, all 58 wilayas with code + name (e.g. "16 — Alger"), keyboard-first, remembers recent |
| Commune | Dependent combobox filtered by wilaya |
| Product | Combobox with thumbnail + name + status pill in each option |
| Quantity | Stepper (− n +) |
| Date | Date picker with quick presets; **date range** picker for all filters with presets: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Custom |
| Status | Pill select (see above) |
| Expense category | Icon + label select: shooting `camera`, packaging `box`, échantillon `flask-round`, confirmation `phone-call`, delivery `truck`, test ads `flask-conical`, scaling ads `trending-up`, other `ellipsis` |
| Long text / notes / comments | Auto-growing textarea, character-count only if limited |
| Rules / meeting notes | Simple rich text (bold, lists, headings) or markdown with preview — pick one, keep it light |
| Images (product) | Drag-drop uploader with preview grid, reorder, primary image marker |
| Multi-filter | Chip-based multi-select with counts, clearable individually and "Clear all" |
| Toggles | Switch with label on the left, description under it |

Form rules: labels above fields, never placeholder-as-label · inline validation on blur with clear fix instructions (never "Invalid input") · required fields marked · **primary action right, cancel left, destructive separated and colored red** · autosave where safe, otherwise a sticky save bar that appears only when dirty · every dialog closable with Esc · every form submittable with ⌘/Ctrl+Enter · loading buttons show a spinner and stay disabled.

---

## STEP 4 — NAVIGATION: EVERYTHING ONE CLICK

Persistent left sidebar, **always-expanded subsections** (no accordion that hides children behind a click):

```
Dashboard
Orders
  · All
  · Confirmation
  · Delivery
Products
Finance            (admin only)
  · Overview
  · Expenses
  · Ad spend
  · Income
Contacts
  · Customers
  · Suppliers
Team & Rules
  · Rules
  · Meetings
  · Tasks
  · Performance
  · Users
  · Audit log
Settings
```

- Active state is unmistakable (bg tint + left accent bar + icon color).
- Live counters on the items that need action: Confirmation (pending count), Delivery (awaiting deposit), Tasks (my open tasks) — badge, muted when zero.
- Collapsible to icon-rail on small screens, with tooltips; sidebar state persists.
- **Command palette (⌘K / Ctrl+K)**: jump to any section, search orders by phone or order ID, search products/customers, run actions ("Add expense", "New order").
- Breadcrumb only where depth exists (product detail, order detail).
- Every table row opens a **detail panel/sheet** without losing the list; deep-link URLs still work.
- Global keyboard shortcuts documented in a `?` overlay.

---

## STEP 5 — PER-SECTION UI SPECS

### Dashboard
- Sticky filter bar at top: date range · product · wilaya · source · agent · status. Filters are URL-persisted (shareable) and remembered per user. Active filters shown as removable chips.
- Row of KPI cards: Revenue · Total spend · **Net profit** · Confirmation rate · Delivery rate · Orders. Each card: big tabular number, label, delta vs previous period (green/red arrow), sparkline. Clicking a card filters the views below.
- Funnel (received → confirmed → shipped → delivered) as a horizontal stepped bar with counts and drop-off %.
- Profit/spend over time: line or bar chart, **never both axes on wildly different scales without a second axis label**.
- Delivery rate per wilaya: sortable table with in-cell rate bars + "stop shipping" flag column, **beside a small inline-SVG choropleth of Algeria's 58 wilayas** (no mapping library, no tiles). Hover syncs map↔table both ways, click filters the dashboard, low-volume wilayas render neutral as "not enough data", map stacks below the table on narrow screens.
- Per-agent and per-product rate tables, sortable, top/bottom highlighted.
- Spend by category: single horizontal bar breakdown or donut with a legend that includes values, not just colors.
- **Quick actions row**: "Add ad spend" (opens a small modal: product, date, amount, currency, test/scaling — 4 fields, done in 5 seconds), "New order", "Add expense". Ad spend must ALSO live on the product page; it must never be an awkward inline widget in a chart area.
- Next meeting card + my open tasks card (admin view).
- Every chart: real empty state ("No orders in this range — try Last 30 days"), skeleton while loading, tooltip with formatted DZD, no gradients-for-decoration, max 5 series, colorblind-safe palette derived from tokens.

### Orders (All / Confirmation / Delivery)
- Dense data table: sticky header, sticky first column (customer/order), column visibility menu, saved views, sort, pagination or virtualized infinite scroll, row density toggle.
- Columns: order # · date · customer + phone · product (thumb) · qty · price · **delivery fee** · wilaya · source badge (Shopify/LightFunnels/Manual with icon) · confirmation pill · delivery pill · agent.
- **Duplicate flag**: `copy-warning` icon chip on the row + a filter "Duplicates only".
- **Bulk selection** with a floating action bar: change status for N orders, assign agent, export CSV.
- **Confirmation view = table list, click a row to open its detail sheet** (this is the decided default — do NOT build a separate one-order-at-a-time "call mode"). The sheet contains, in this order: customer name + big click-to-call phone link (`tel:`), **risk score badge** (green/amber/red, reason on hover: "3 returns / 7 orders"), their previous orders, product + quantity + price, status buttons as large targets, comment box. Sheet has "Save" and "Save & open next" so an agent can work down the queue without closing it, plus ↑/↓ keys to move between rows. Rows already handled fade/leave the pending filter.
- Delivery view: **dense table by default**, groupable by delivery stage, with an optional kanban toggle (drag between statuses) that respects allowed transitions. Quick status-advance button on each row; delayed/returning rows highlighted.
- Order detail sheet: timeline of every status change (who, when, how long in each stage), customer block, money block (price, delivery fee, computed margin — hidden for agent roles), comments.

### Products
- **Grid of image cards is the default**, dense table available as a persisted toggle. Card: image with consistent aspect ratio (placeholder when missing), name, status pill, sale price, delivery rate, net profit color-coded, 30-day sparkline, kebab for quick actions. Fixed card height keeps the grid even.
- Product page tabs: **Overview · Pricing · Expenses · Orders · Stats**.
- Overview: images, tissu, category, variants, sale price, sourcing cost.
- Pricing: 4 columns side by side — Best / Medium / Worst (editable) and **Real** (read-only, from live data). Inputs on the left rail, results table below with net profit per delivered / daily / monthly, each figure color-coded (profit green, loss red). Changing an input recalculates instantly. A one-line "break-even" indicator: minimum delivery rate needed for profit at current inputs.
- Expenses tab: table + "Add expense" modal, category chips with icons, totals per category, and the ad-spend quick entry pinned at top.
- Stats tab: the product's own KPI cards + funnel + per-wilaya table, same components as the dashboard (reuse, don't rebuild).

### Finance (admin only, RLS-enforced)
- Subsections: Overview · Expenses · Ad spend · Income.
- Overview: invested vs revenue vs net profit, spend by category, spend by product, fixed fees, all date-range filtered, everything drillable.
- Expenses and Ad spend: **the same table and form components used on the product page**, unfiltered here. Adding from either place produces the identical record.
- Income: derived from delivered orders, grouped by product, with returns and return fees netted against them. No manual income entry exists anywhere in the app.

### Contacts
- Tabs: Customers · Suppliers.
- Customers table: name, phone, wilaya, orders, delivered, returned, **risk score pill**, last order date. Detail sheet with full order history timeline.
- Suppliers: type chip (studio `camera`, atelier `scissors`, emballage `package`, other), phone with click-to-call, location, notes, linked expenses total.

### Team & Rules  *(replaces Slack — this section must be genuinely usable)*
- **Rules**: editable document blocks — Store rules · Product selection criteria · Roles & duties. Each block: title, rich text, last edited by/when, version history if cheap. Read-only for non-admins, always visible to everyone.
- **Meetings**: recurring schedule (2 fixed meetings per week, days + times configurable in Settings). Views: Upcoming / Past.
  - Meeting card: date, time, attendees (avatars), status (Planned → Ready → Held).
  - **Objectives checklist** — added before the meeting by anyone; each objective has a title, optional note, and owner. **A meeting cannot be marked "Held" until every objective is checked or explicitly deferred.** Deferred objectives auto-appear in the **next meeting's objectives** list, marked "carried over".
  - **Decisions / notes** field filled during or after the meeting.
  - **Tasks**: created from a meeting (or standalone) with title, owner, due date, priority, status (todo / doing / done / blocked). Tasks created in a meeting stay linked to it.
  - Auto-generated agenda view for the meeting: carried-over objectives + new objectives + open tasks due, printable/copyable to WhatsApp in plain text (a "Copy agenda" button).
- **Tasks** (own page): **kanban board by status is the default** — Todo / Doing / Blocked / Done, drag between columns with a keyboard-accessible status select on each card, transitions validated, optimistic update with rollback. Card: title, owner avatar, due date (red when overdue), priority dot, meeting-link chip when it came from a meeting. Counts in column headers. Filters: owner, priority, due, product; "My tasks" default. List view available as a toggle. Dashboard shows each user's open tasks.
- **Performance**: per-agent cards — confirmation rate, avg time to confirm, orders handled, delivery rate. Simple bars, honest numbers, date-range filtered.
- **Users**: invite by email, role select with a plain-language description of what each role can see, active/inactive toggle.
- **Audit log**: filterable table (user, entity, action, date), old → new value diff shown inline.

### Settings
- Grouped cards with clear section titles: Workspace · Integrations · Delivery fees (wilaya table, inline-editable, bulk paste) · Monthly fixed fees · Exchange rates · Rules of the engine (return fee, duplicate window, risk weights, stop-shipping threshold) · Meeting schedule · Appearance (theme: dark default / light / system, density).
- Integrations: copyable webhook URL, secret field masked with reveal, connection health ("Last event received 4 min ago" green / "No events in 3 days" amber) and a "Send test event" button.

---

## STEP 6 — STATES, FEEDBACK, QUALITY FLOOR

Every list, card, and chart needs all four states designed: **loading (skeleton, not spinner-on-blank), empty (with a primary action), error (what happened + retry), populated**.

- Toasts for every mutation: success (with undo when reversible), error (with the actual reason).
- Destructive actions: confirm dialog naming the exact item ("Delete order #1042?").
- Optimistic updates on status changes, rolled back visibly on failure.
- Responsive: usable on a laptop first, functional on a tablet, and the Confirmation queue must work on a phone (agents may call from mobile).
- Accessibility floor: visible focus rings, full keyboard operation of every control, `aria-label` on icon-only buttons, 4.5:1 contrast, `prefers-reduced-motion` respected. Motion is limited to 150–200ms transitions and sheet/dialog entrances — no decorative animation.
- Performance: virtualize tables over ~200 rows, debounce filter inputs, memoize chart data, server-side pagination and aggregation (do NOT ship all orders to the client to compute rates).

**Self-critique loop (mandatory for Sonnet in every UI phase):** after building, screenshot the page in both themes with the browser MCP, compare against `DESIGN_SYSTEM.md`, fix contrast/spacing/state gaps, and only then mark the phase done. Note in `PROGRESS.md` what was screenshotted and fixed.

---

## STEP 7 — BACKEND QUALITY (so the polish isn't skin-deep)

- All inputs validated with **zod** on both client and server; webhook payloads validated and stored raw before parsing.
- Server Actions / route handlers return typed results; errors surface real messages to the toast layer.
- Postgres: indexes on `orders(workspace_id, created_at)`, `orders(phone_normalized)`, `orders(product_id)`, `order_status_history(order_id)`; aggregate KPIs via SQL views or RPC functions, not client loops.
- Supabase **Realtime** on orders so a new webhook order appears live in the Confirmation queue with a subtle "1 new order" pill (never a jarring re-sort under the agent's cursor).
- RLS tested: write a script that logs in as each role and asserts financial fields are unreachable.
- Money stored in integer minor units or numeric(12,2) — pick one and document it; never float arithmetic for money.
- Timezone: store UTC, display Africa/Algiers.
- All computed rates guard division by zero and display "—".

---

## SKILLS & TOOLING TO SET UP (do this as part of planning)

Create project skills in `.claude/skills/<name>/SKILL.md` so every Sonnet chat inherits the rules without re-reading the whole spec:

1. **`design-system`** — tokens, status color/icon map, typography, spacing, do/don't examples, "never hardcode a color" rule. *Trigger: any UI work.*
2. **`forms-and-inputs`** — the input inventory table, validation patterns, form layout rules, the money/phone/wilaya field APIs.
3. **`data-tables`** — table conventions: columns, sticky header, bulk actions, filters, URL state, virtualization, empty states.
4. **`charts`** — which chart for which metric, palette, tooltip/format rules, empty & loading states, DZD formatting.
5. **`supabase-rls`** — how to write a migration + policy pair, role matrix, the "agents never see money" invariant, test procedure.
6. **`cod-domain`** — the business vocabulary (wilaya, stop desk, confirmation vs delivery rate, return fee) and the pricing formulas, so Sonnet never re-derives them wrong.
7. **`phase-handoff`** — how to start a phase (read CLAUDE.md + PROGRESS.md + phase file only) and how to close it (screenshots, tests, PROGRESS.md entry).

Recommend to the user these MCP servers, and record in `docs/TOOLING.md` which are actually available: **shadcn** (component installation/registry), **Supabase MCP** (schema + migrations + RLS from the CLI), **Playwright or Chrome DevTools MCP** (screenshots for the self-critique loop — this is the highest-value one for fixing the UI), plus the user's existing **graphify** and **poneytail** (inspect their real descriptions and assign them roles in the workflow). Also use the built-in **frontend-design** skill when producing the design direction.

---

## DELIVERABLES OF THIS CHAT (architect)

1. `docs/design/UI_AUDIT.md` + screenshots.
2. `docs/design/DESIGN_SYSTEM.md` (tokens, statuses, components, icon map) + a `/design-preview` route spec.
3. Two design directions presented to the user for approval **before** refactoring begins.
4. `.claude/skills/*` skill files listed above.
5. Updated `docs/phases/*` — the UI overhaul runs **after the 10 functional phases are complete**, as phases 11–13, not before them:
   - **Phase 11 — Design system foundation**: tokens (dark-first), both themes correct, shadcn install and central theming, status system, field components, `/design-preview` route, sidebar/navigation rebuild.
   - **Phase 12 — Section pass**: apply the system section by section (Dashboard, Orders, Products, Contacts, Team & Rules, Settings), one per session, using the checklists.
   - **Phase 13 — Final sweep**: contrast, keyboard, mobile, empty/loading/error states, hardcoded-color grep, screenshot review in both themes.
   During phases 1–10, do not invest in visual polish — build with plain, functional markup and correct semantics so the design pass can restyle cleanly. But keep the structure restyle-friendly: no inline styles, no hardcoded colors, all statuses through one helper even if it's ugly at first.
6. Updated `CLAUDE.md` with the design rules and the mandatory screenshot self-critique step.

Do not implement features in this chat. Audit, design, document, hand off.
