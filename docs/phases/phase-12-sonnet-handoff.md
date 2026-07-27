# Phase 12 handoff for Sonnet — one section per session

You (Sonnet 5) are executing **one section of Phase 12 per chat**. This file is
the shared brief: read it in full, then the per-section block for the section you
are doing. It exists because each chat starts cold — everything you need to reuse
is listed here so you don't re-invent what §1 (data-table) and §2 (Orders)
already built.

**Do NOT read this instead of the real sources.** It's a map. Read
`section-checklists.md` for the acceptance boxes, and open the files it names.

---

## 0. Session protocol (do this every chat)

1. Read `CLAUDE.md`, `PROGRESS.md`, `docs/phases/phase-12.md`, this file, and the
   `cod-ui-polish` skill references named in `phase-12.md`
   (`components.md`, `interconnection.md`, `section-checklists.md`,
   `option-sets.md`, `design-tokens.md`, `status-system.md`).
2. Identify the next unfinished section from the "Phase 12 §…" blocks in
   `PROGRESS.md`, in this order: **§3 Products → §4 Finance → §5 Dashboard →
   §6 Contacts → §7 Team & Rules → §8 Settings → §9 Option sets.** Do ONLY that one.
3. Branch: work on `mnw-12` (it already exists; `git checkout mnw-12` then make
   sure it's current with `mnw` — if behind, ask the user before any hard reset,
   the classifier blocks `git reset --hard`).
4. Orient with `graphify query "<question>"` instead of broad greps. Invoke the
   `ponytail:ponytail` skill before writing code and `ponytail:ponytail-review`
   on the diff before merging.
5. Finish the section COMPLETELY (all four states, both themes, keyboard, mobile
   where the checklist requires it, every drill-through) before stopping.
6. Gate: `npm run build` + `npm test` green, forbidden-color grep = 0, no native
   `<select>`/raw `<input>` in the section. Then `graphify update .`, append a
   `## Phase 12 §N — <title> (<date>) — DONE` block to `PROGRESS.md`, and merge
   `--no-ff` into `mnw`.

---

## 1. Non-negotiable invariants (from the cod-ui-polish skill)

- **No hardcoded colors.** Every color is a CSS variable from `globals.css`.
  `text-white`, `bg-white`, `text-black`, `bg-black`, `#hex`, `rgb(...)`,
  `glass-card`, `text-gradient` in feature code are BUGS. Grep the files you
  touch before finishing:
  `grep -rnE 'text-white|bg-white|text-black|bg-black|#[0-9a-fA-F]{3,6}|rgb\(|glass-card|text-gradient' <files>`
- **Dark is the default theme; light must be equally correct.** Verify both.
- **No raw `<input>` or native `<select>` in feature code.** Use
  `components/fields/*` and the Radix Select. (`components/ui/native-select` is the
  banned one — it caused the white-on-white dropdown bug. Do not import it.)
- **Every status via `<StatusPill>` / `<StatusSelect>`** from one source
  (`src/lib/statuses.ts`). No ad-hoc colored `Badge`s for status.
- **Four states always:** loading (skeleton) / empty (with an action) / error
  (reason + retry) / populated — on every list, card, table, chart.
- **Money is tabular:** right-aligned, `.num` (tabular-nums), thousands
  separators, `DA`/DZD suffix, color-coded (profit success / loss danger). Use
  `formatCurrency` from `src/lib/format.ts` or `<MoneyField>`.
- **Nothing is a dead end** (interconnection.md): every number/rate/segment
  drills through to the filtered records behind it; every two-home record
  (expense, ad spend, task, order) is created+edited from both places via the
  **same** component; detail views show their relations with counts + "View all".
- **RLS is the wall.** Financial tables are admin-only; Finance (§4) must be
  invisible+unreachable to agents (RLS-backed, `AdminGuardLayout`), not just
  hidden in the UI. Status changes go through the `transition_order_status` RPC /
  triggers — never insert into `order_status_history` from the app.

---

## 2. Reusable infrastructure (built in §1/§2 — USE THESE, don't rebuild)

### Data table — `src/components/data-table/`
`<DataTable<T>>` (client). Props: `tableId` (namespace for persisted density +
column visibility), `columns: Column<T>[]`, `rows`, `rowKey`, `total`+`pageSize`
(enables server pagination), `status` (`"loading"|"error"`), `onRetry`,
`defaultDensity` (`"comfortable"|"compact"`), `empty` ({title, description,
action}), `selectable`, `bulkActions(keys, clear)`, `rowActions(row)`,
`renderSheet(row) => {title, body}`.
- It owns URL params: `?sort=<colId>&dir=asc|desc`, `?page=`, `?row=<key>`
  (deep-links the sheet). The **server page** reads `sort`/`dir`/`page` from
  `searchParams`, queries with `.order()`/`.range()`, and passes the current
  page's rows + `total`. Filters are NOT the table's job — build a per-section
  client filter bar that writes other URL params (see `orders-filter-bar.tsx`).
- `Column<T>` (`types.ts`): `{ id, header, cell(row), align?, numeric?, sortable?,
  sticky?, defaultHidden?, alwaysVisible?, width? }`.
- `renderSheet` renders from an already-loaded row. Give the sheet **body** a
  `key={rowKey}` if it holds local state (so it resets per row). Deep-linked
  `?row=` only opens if the key is on the current page — if a page must deep-link
  an arbitrary record, fetch that row server-side for the sheet.
- Pattern: a **server page** does the query and builds serializable rows, a
  **client `*-table.tsx`** wrapper defines columns/sheet/bulk and renders
  `<DataTable>`. Copy `src/app/app/orders/all/{page.tsx,orders-all-table.tsx}`.

### Status system — `src/lib/statuses.ts`
`getStatus(kind, key)`, `transitionsFor(kind, current)` (current + legal next),
`STATUS_KINDS` for kinds `"confirmation" | "delivery" | "product" | "task"`.
- `<StatusPill kind status size showIcon />` (`src/components/status-pill.tsx`).
- `<StatusSelect kind value onChange name />`
  (`src/components/status-select.tsx`) — pill in trigger + options, offers only
  legal transitions, posts via `name` in a form.
- `<RiskBadge score reason size />` (`src/components/risk-badge.tsx`) — shield
  grammar for customer risk.

### Field components — `components/fields/` (never a raw input)
`MoneyField` (tabular DZD, `DA` suffix, hidden `name`, USD/EUR shows live DZD
conversion; now has optional `onChange(value)` that fires on **user input only** —
to re-seed it programmatically, remount with a `key`), `PercentField`,
`PhoneField` (DZ normalize + dup hint), `QuantityStepper`, `DateField` +
`DateRangeField` (presets), `WilayaCombobox`/`CommuneCombobox`/`ProductCombobox`
(from `comboboxes.tsx`), `CategorySelect` (expense categories w/ icons),
`OptionSelect`/`OptionMultiSelect` (Notion-style taxonomy — §9 wires the backend),
`AutoTextarea`, `SettingSwitch`. Comboboxes/MoneyField/QuantityStepper are
controlled internally and post via a hidden `<input name>`.
- Plain text (name/city/notes) may use `<Input>` from `components/ui/input` — that
  is the styled primitive, not a banned raw input.
- Radix `<Select>` is `components/ui/select` (Trigger/Content/Item/Value). It
  **cannot use an empty-string value** — use a sentinel like `"__all"`/`"__none"`
  and map it back. It posts via `name` too.

### Other primitives
- `<Chip token size dot icon>` (`components/ui/chip`) — token palette
  (neutral/success/warning/danger/info/indigo/cyan/violet/orange/rose). Base for
  all pills/chips.
- `<Sheet>`/`SheetContent`/`SheetTitle` (`components/ui/sheet`) — side sheet.
- Toasts: `import { toast } from "sonner"` (`toast.success/error`). `Toaster` is
  already mounted in `app/layout.tsx`.
- CSV: `toCSV(cols, rows)` + `downloadCSV(name, csv)` from `src/lib/csv.ts`.
- Money/date: `formatCurrency`, `formatDate`, `formatDateTime` from `src/lib/format.ts`.
- `ButtonLink` (`components/button-link`) — link styled as a button. **`Button`
  has NO `asChild`**, so wrap links with `ButtonLink`, not `<Button asChild>`.
- `<PageHeader>`, `<Field>` (label wrapper), `<Empty>`, `<DeleteButton>`,
  `TabsNav` (admin-only section switcher), `<AdminGuardLayout>` (re-export as a
  `layout.tsx` to gate an admin-only route tree).

### §2 patterns worth copying
- `src/app/app/orders/orders-filter-bar.tsx` — URL-persisted Radix-select filter
  bar with active-filter chips + clear-all. Template for every filter bar.
- `src/app/app/orders/order-timeline.tsx` — reusable event timeline (actor +
  duration per stage). Reuse for customer/order history anywhere.
- `src/app/app/orders/delivery/delivery-kanban.tsx` — kanban template: columns
  from a status set, native HTML5 drag + on-card `<StatusSelect>` (the
  keyboard-accessible equivalent), only legal transitions accepted, optimistic
  move with rollback + toast. **Reuse this shape for the §7 Tasks kanban.**
- Bulk/mutation actions return `UpdateResult = {ok:true}|{ok:false,error}`; the
  client `run`s them → toast + `router.refresh()`.

### i18n
Every user-visible string goes in `src/messages/{en,ar}.json`. `useTranslations()`
in client components, `getTranslations()` in server components. ICU plurals are
supported (`"{count, plural, one {# x} other {# xs}}"`). AR is RTL — use logical
CSS (`ps-`, `pe-`, `border-e`, `start-0`), never `left/right`.

---

## 3. Running the app locally (for the mandatory screenshot self-critique)

**Never point dev at the remote.** The Supabase docker stack is already up on
`127.0.0.1:54321` with Supabase's public demo keys.

The repo's `npm run dev` wrapper does **not** inherit inline env exports, so
create a **gitignored** `.env.development.local` (higher precedence than the
remote-pointing `.env.local`) and delete it when done:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UtZGVtbyIsImlhdCI6MTY0MTc2OTIwMCwiZXhwIjoxNzk5NTM1NjAwfQ.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
APP_URL=http://localhost:3000
```

Then `npm run dev` (run it in the background), open `http://localhost:3000`, sign
in as **`admin@seed.mnw` / `SeedDev!2026`** (the seed workspace holds the demo
data; other local users are in `scripts/seed-dev.ts`). Use the **Playwright MCP**
to screenshot each screen you touched in **both themes** into
`docs/design/audit/`, fix what the shots show, and note it in `PROGRESS.md`. If a
migration is needed (only §9), apply it to the local DB first
(`docker exec supabase_db_mnw-erp psql -U postgres -d postgres -f - < file.sql`
or `supabase db push` against local), then regen types. Delete
`.env.development.local` before you finish. If no browser MCP is available, say so
explicitly — do not silently skip the screenshot pass.

---

## 4. Per-section briefs

Read `section-checklists.md` for the full acceptance list; these are the highlights
+ what to reuse + gotchas.

### §3 Products
- **List → image-card grid is the DEFAULT view; table is a secondary toggle**
  (persist per user, e.g. `?view=table` or localStorage). Card (fixed height so
  the grid stays even): image filling the top at a consistent aspect ratio
  (placeholder when missing — products have no images in seed, an uploader is
  optional/out of scope unless trivial), name, **`<StatusPill kind="product">`**,
  sale price, delivery rate, **net profit color-coded**, 30-day sparkline, kebab.
- **Product page: product-context header** (name / image / status pill +
  breadcrumb) shown across all tabs. Tabs: Overview · Pricing · Expenses · Orders
  · Stats (routes already exist under `products/[id]/`).
- **Pricing: add the 4th read-only "Real" column** + a **break-even indicator**
  ("needs ≥ X% delivery rate to profit at these inputs"). The Real data source
  already exists: `src/lib/pricing-real.ts` (`realInputsForProduct`, returns
  `hasData`). The scenario engine is `products/scenario-engine.tsx`; pricing math
  is `src/lib/pricing.ts` — **do not fork the formulas**. Inputs → Money/Percent
  fields with suffixes + live "≈ … DA at rate" conversion.
- **Expenses tab uses the SAME expense form + table as Finance → Expenses**
  (interconnection — build the shared component in §4 or here and reuse), plus the
  ad-spend quick entry `src/components/ad-spend-entry.tsx` pinned at top,
  pre-filled to this product. Income appears automatically from delivered orders.
- **Stats tab reuses the dashboard KPI/funnel/wilaya components** — no parallel
  implementations (coordinate with §5; if §5 isn't done, extract shared components).
- Files: `products/page.tsx`, `product-form.tsx`, `[id]/{layout,expenses,stock,
  statistics,pricing}/`, `scenario-engine.tsx`, `pricing-real.ts`, `pricing-data.ts`.

### §4 Finance (admin-only)
- The `/app/finance` route ALREADY EXISTS (`layout.tsx` + `page.tsx` +
  `overview/`, `expenses/`, `ad-spend/`, `income/`) — likely Phase-11 stubs.
  Check them and build the real subsections. Keep the whole tree behind
  `AdminGuardLayout` (agents must not reach it — RLS already blocks the data).
- **Overview:** invested vs revenue vs net profit for the period, spend by
  category, spend by product, monthly fixed-fees line — all date-range filtered
  (reuse the `dashboard_stats` RPC / `DateRangeField`), every total drillable.
- **Expenses & Ad spend: the SAME table + form component used on the product
  page** — unfiltered here, product-filtered there. Adding from either place
  creates the identical record. Build `<ExpenseForm>`/`<AdSpendForm>` +
  `<ExpenseTable>` once. `CategorySelect` for categories, `MoneyField` for money.
- **Income: derived from delivered orders, returns netted, NO manual entry.**
- Financial tables (`expenses`, `ad_spend_daily`, `fixed_fees`, etc.) are
  admin-only per CLAUDE.md — verify at the RLS level, not just the UI.

### §5 Dashboard
- **Sticky filter bar** (reuse the `orders-filter-bar.tsx` pattern): date range ·
  product · wilaya · source · agent · status; URL-persisted; active chips;
  remembered per user. `dashboard/page.tsx` already reads these into
  `dashboard_stats`.
- **KPI cards** (Revenue/Spend/Net profit/Confirmation rate/Delivery rate/Orders):
  big tabular number, label, **delta vs previous period** with arrow, sparkline,
  **click-to-filter** the section below.
- **Funnel** with drop-off %; **profit/spend over time** (recharts, one question
  per chart — see `components.md` chart rules).
- **Per-wilaya table with in-cell rate bars BESIDE a small inline-SVG Algeria
  choropleth** (58 wilayas, no map library, 4–5 step token color scale; hover
  syncs table row ↔ region both ways; click filters; stop-shipping wilayas
  outlined; low-data neutral; map stacks below the table on narrow screens). The
  table already exists in `dashboard/page.tsx` — the **map is the main new build.**
- Per-agent + per-product rate tables; spend-by-category chart with values in the
  legend.
- **Quick-actions row: Add ad spend as a 4-field MODAL** (product, date, amount +
  currency, test/scaling) — **remove the inline `AdSpendEntry` widget** currently
  stuffed into the dashboard (UI_AUDIT finding). Plus New order, Add expense.
- Next-meeting card + my-open-tasks card.

### §6 Contacts
- **Customers:** `<DataTable>` (name, phone click-to-call, wilaya, orders,
  delivered, returned, **risk pill**, last order) + **detail sheet with the
  order-history timeline** — reuse `order-timeline.tsx`. Drill-through on counts.
- **Suppliers:** type chip (studio `camera`, atelier `scissors`, emballage
  `package`, other) — this is a taxonomy that §9 turns into an option set; use
  `OptionSelect` if §9 is done, else a plain chip. Click-to-call, location, notes,
  **linked-expenses running total**.
- Files: `contacts/page.tsx`, `contacts/[id]/`, `suppliers/`, `tabs.tsx`,
  `risk-badge.tsx`.

### §7 Team & Rules
- **Rules:** blocks for Store rules / Product selection criteria / Roles & duties —
  rich text, "last edited by/when", read-only for non-admins but visible to all.
- **Meetings:** Upcoming/Past cards (Planned→Ready→Held); objectives checklist per
  meeting with owners; **cannot mark Held until every objective is checked or
  deferred**; deferred ones carry over tagged; decisions/notes; tasks stay linked;
  "Copy agenda" → WhatsApp-pasteable plain text.
- **Tasks: KANBAN by status is the DEFAULT** (list view as a toggle) — columns
  Todo/Doing/Blocked/Done, drag + a status select on each card (keyboard
  alternative), respect allowed transitions, counts in headers, card shows title/
  owner/due (red overdue)/priority dot/meeting-link chip. **Reuse the
  `delivery-kanban.tsx` shape with `kind="task"`.** Filters: owner/priority/due/
  product; "My tasks" default.
- **Performance** bars per agent (confirmation rate, avg time to confirm, orders
  handled, delivery rate; date-filtered). **Users:** invite by email, role select
  with plain-language descriptions, active toggle. **Audit log:** filterable,
  old→new diff inline (a diff renderer already exists in `team/audit/`).
- Files: `team/*`, `meetings/`, `rules/`, `audit/`, `performance/`, `tasks/`,
  `user-row.tsx`, `invite-form.tsx`.

### §8 Settings
- **Regroup the one-long-scroll into grouped cards with a section nav/anchors:**
  Workspace · Integrations (copyable webhook URL, masked secret with reveal,
  health "Last event 4 min ago", **test event** button) · Delivery fees per wilaya
  (inline-editable + **bulk paste**) · Monthly fixed fees · Exchange rates ·
  Engine rules (return fee, duplicate window, risk weights, stop-shipping
  threshold) · Meeting schedule · **Appearance (dark default / light / system,
  density)**. Money via `MoneyField`. **Destructive actions separated + red.**
- The section-scroll already has all subsections
  (`settings/{workspace,integrations,fees,fixed-fees,exchange-rates,thresholds,
  webhook-events}-section.tsx`) — this is mostly a **regroup + field-component +
  Appearance** pass, not a rebuild.

### §9 Option sets
- Implement `option_sets` / `options` tables + the inline-create `OptionSelect`
  per `references/option-sets.md` (the `OptionSelect` component shell already
  exists at `components/fields/option-select.tsx`). **This needs a NEW migration**
  (`supabase/migrations/000XX_option_sets.sql`): the two tables + `workspace_id` +
  RLS (`current_workspace_id()` + admin-write) + `set_updated_at` + `audit_row`
  triggers + seed defaults; add to `docs/DB.md`; regen types. Apply to the LOCAL
  db and verify before wiring UI.
- Management screen in **Settings → Options** (list every set, options
  reorderable/recolorable/renamable/archivable/mergeable, usage counts).
- **Wire the taxonomy fields** to `OptionSelect`: supplier type, product category,
  tissu/fabric, expense subcategory, tags, cancellation reason — with `+ Create
  "…"` inline, chips rendered identically in trigger/options/tables/filters.

---

## 5. Gotchas that bit the last session (save yourself the time)

- `Button` has no `asChild` → use `ButtonLink` for link-styled buttons.
- Radix `<Select>` can't take an empty-string value → sentinel (`"__all"`/`"__none"`).
- `MoneyField`/`QuantityStepper`/`Combobox` are internally controlled + post via a
  hidden `name`. To externally re-seed a `MoneyField`, remount it with a `key`;
  use its `onChange` (fires on user input only) to detect manual overrides.
- `order_status_history.id` is numeric; the shared `TimelineEvent.id` is
  `string | number`.
- Local dev: the `npm run dev` wrapper ignores inline env exports — use
  `.env.development.local` (see §3) and delete it after.
- The classifier blocks `git reset --hard` and live-remote mutations — do local
  work; hand remote steps to the user.
- Screenshots land in the project root from the Playwright MCP — move them into
  `docs/design/audit/` before committing.
- Stage only YOUR section's files at merge time (there are unrelated untracked
  files like `OPUS_*.md` — don't add them). `graphify-out/` is gitignored.
