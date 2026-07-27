# Components

Built on shadcn/ui (Radix) wired to tokens, Tailwind for layout, lucide for icons, recharts for charts.

## Field inventory — `components/fields/`

| Data | Component | Behavior |
|---|---|---|
| Money DZD | `MoneyField` | right-aligned, tabular, live thousands separators, `DA` suffix, no spinners, tolerates pasted spaces |
| Money USD/EUR | `MoneyField` + currency chip | shows live DZD conversion beneath: "≈ 268 400 DA at 268.4" |
| Percent | `PercentField` | `%` suffix, clamp 0–100, optional slider companion in the pricing calculator |
| Phone | `PhoneField` | Algerian mask, normalizes 0X / +213 / spaces, inline "existing customer" hint with link |
| Wilaya | `WilayaCombobox` | searchable, all 58 as "16 — Alger", keyboard-first, recents on top |
| Commune | `CommuneCombobox` | dependent on wilaya, disabled with a reason until wilaya is set |
| Product | `ProductCombobox` | thumbnail + name + status pill per option |
| Quantity | `QuantityStepper` | − n + |
| Date | `DateField` | picker + typed entry |
| Date range | `DateRangeField` | presets: Today, Yesterday, Last 7 days, Last 30 days, This month, Last month, Custom |
| Status | `StatusSelect` | pill in trigger and in every option, respects allowed transitions |
| Expense category | `CategorySelect` | icon + label: shooting `camera`, packaging `box`, échantillon `flask-round`, confirmation `phone-call`, delivery `truck`, test ads `flask-conical`, scaling ads `trending-up`, other `ellipsis` |
| Any user-extensible taxonomy (atelier type, product category, tissu, tags) | `OptionSelect` / `OptionMultiSelect` | Notion-style: chips in the trigger, type to filter, `+ Create "…"` row, auto color, inline management — see `option-sets.md` |
| Notes | `AutoTextarea` | grows with content |
| Rules / meeting notes | `RichText` | bold, lists, headings, links — nothing more |
| Images | `ImageUploader` | drag-drop, preview grid, reorder, primary marker |
| Multi-filter | `FilterChips` | multi-select with counts, individually clearable, "Clear all" |
| Toggle | `SettingSwitch` | label left, description beneath |

## Form rules

Labels above fields (never placeholder-as-label) · required marked · validation on blur with a fix instruction, never "Invalid input" · primary action bottom-right, cancel left, destructive separated and red · sticky save bar appears only when dirty · Esc closes dialogs · ⌘/Ctrl+Enter submits · submitting buttons show a spinner and stay disabled · after success, toast names what happened in the same verb as the button ("Save changes" → "Changes saved").

## Tables

The workhorse of this app. `components/data-table/`:

- Sticky header, sticky first column, column visibility menu, per-user saved views, multi-sort, density toggle.
- **URL-persisted filters and sort** so a view can be shared and survives refresh.
- Server-side pagination and aggregation — never fetch all orders to compute a rate in the browser. Virtualize beyond ~200 rows.
- Row click opens a detail sheet; the list stays behind it and keeps scroll position. Deep links still resolve to the same sheet.
- Bulk selection with a floating action bar: change status for N, assign agent, export CSV.
- Numeric columns right-aligned and tabular; text left; status pills centered in their own narrow column.
- Inline row actions in a trailing kebab, never a row of five icon buttons.
- Hover row highlight, keyboard row navigation (↑/↓, Enter to open).

## Charts

Each chart answers exactly one question, stated in its title. Rules: max 5 series · token-derived colorblind-safe palette · axis labels with units · DZD formatted in tooltips · no gradients-for-decoration, no 3D, no pie beyond 4 slices (prefer horizontal bars) · dual axes only with both labeled · legends carry values, not just colors · every chart has skeleton, empty ("No orders in this range — try Last 30 days"), and error states.

Mapping: trends over time → line · comparisons across categories/wilayas/agents → horizontal bars sorted by value · composition of spend → stacked horizontal bar or donut with values · funnel → stepped horizontal bars with counts and drop-off % · a single metric over time on a card → sparkline, no axes · geography → inline SVG choropleth only (see below), never a tiled map library.

## Map (dashboard only)

One map in the entire app: delivery rate by wilaya, sitting beside its table. Inline SVG of Algeria's 58 wilayas, no tiles, no mapping library, no zoom/pan. Colored on a 4–5 step scale built from tokens (low rate → danger, high → success), with a legend showing the ranges. Wilayas below the minimum order threshold render neutral as "not enough data", never as a false extreme. Hover syncs highlight with the table row both ways; click filters the dashboard. "Stop shipping" wilayas get a distinct outline. Stacks below the table on narrow screens.

## Kanban board (Tasks, and optionally Delivery)

Columns from the status set, counts in headers, cards sized to content with a maximum height. Drag and drop must have a keyboard-accessible equivalent — a status select on the card — and must respect allowed transitions. Dropping fires an optimistic update with a toast and rollback on failure. Never lose scroll position on update. Empty column shows a quiet "Nothing here" line, not a blank void.

## Navigation

Persistent left sidebar with **subsections always expanded** (nothing hidden behind an accordion click):

```
Dashboard · Orders (All / Confirmation / Delivery) · Products ·
Finance (Overview / Expenses / Ad spend / Income) ·
Contacts (Customers / Suppliers) · Team & Rules (Rules / Meetings / Tasks /
Performance / Users / Audit log) · Settings
```

Finance is hidden entirely for agent roles (RLS-backed, not just hidden in the UI).

Active item: background tint + left accent bar + colored icon. Live badges on Confirmation (pending), Delivery (awaiting deposit), Tasks (my open) — muted at zero. Collapses to an icon rail with tooltips; state persists. **⌘K command palette**: jump anywhere, search orders by phone or ID, search products and customers, run actions ("Add ad spend", "New order"). `?` shows the shortcut overlay.

## States and feedback

Loading = skeletons shaped like the content, never a spinner on a blank panel. Empty = one sentence explaining what's missing plus the primary action button. Error = what failed and a retry, in the interface's voice, no apologies. Toasts on every mutation, with undo where reversible and the real reason on failure. Destructive confirms name the exact item ("Delete order #1042?").

## Quality floor

Laptop-first, functional on tablet, and the Confirmation queue plus order detail sheet must be fully usable on a phone. Visible focus rings, complete keyboard operation, `aria-label` on icon-only buttons, 4.5:1 contrast, `prefers-reduced-motion` respected. Debounce filter inputs, memoize chart data.
