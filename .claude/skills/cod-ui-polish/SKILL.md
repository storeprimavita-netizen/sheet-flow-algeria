---
name: cod-ui-polish
description: Use this skill for any visual or interaction work in the COD ecommerce ERP — auditing existing screens, fixing broken theming (unreadable dropdowns, hardcoded colors), building or restyling components, status pills, forms and inputs, data tables, charts, navigation, empty/loading/error states, or running the post-feature UI correction pass. Trigger whenever a task touches a page, component, style, color, icon, chart, or layout in this project. Do NOT use for backend, database, RLS, or webhook work.
---

# COD ERP — UI correction and design system

This project's features work; its interface was generated without a design system. This skill is the design authority. When it conflicts with what's already in the codebase, this skill wins.

## Decisions already made (do not re-litigate)

- **Dark theme is the default**; light exists in Settings and must be equally correct.
- **This skill is for the back-office app only** (`/app/**`, `/login`). Public store pages follow `luxe-modesty-store-theme`; the two systems never mix.
- **Navigation = five job-named workspaces** (Sell · Catalog · Store · Money · Team) + Home + Settings, groups always visible, breadcrumb + purpose line on every page — `references/navigation-ia.md`.
- **Icons are Lucide; emoji only in user-authored content** (option labels, tags, task titles, saved view names) — same file.
- **Confirmation queue** = saved views the agent chooses: table (default) or kanban by status, each with its own filters and columns; click a row or card to open the detail sheet. No separate call-mode screen. Spec: `docs/specs/CONF.md`.
- **Shipping view** = dense table by default, kanban as an optional toggle.
- **Products list** = grid of cards with images by default (table is a secondary toggle).
- **Dashboard per-wilaya** = table with in-cell rate bars, with a small map of Algeria beside it.
- **Tasks page** = kanban board by status by default (list is a secondary toggle).

## Non-negotiable invariants

1. **No hardcoded colors.** Every color comes from a CSS variable defined in the token file. `text-white`, `bg-white`, `#hex`, `rgb()` in feature code are bugs. Before finishing any UI task, grep for them in the files you touched.
2. **Dark is the default theme.** Light exists and must be equally correct. Every component is verified in both.
3. **One chip system.** Statuses and user-created options both render through a single `<Chip>` / `<StatusPill>` drawing on one shared color palette. No ad-hoc colored text anywhere. System statuses have fixed keys; taxonomy fields (atelier type, category, tissu, tags) are user-extensible option sets — see `references/option-sets.md`.
4. **No raw `<input>` in feature code.** Use the field components in `components/fields/`. If the right one doesn't exist, build it there first.
5. **Four states, always.** Every list, table, card, and chart has loading (skeleton), empty (with an action), error (reason + retry), and populated.
6. **Money is tabular.** Right-aligned, `font-variant-numeric: tabular-nums`, thousands separators, `DA` suffix. Never a float-formatted raw number.
7. **Nothing is a dead end.** Every number drills through to the records behind it, every detail view shows its relations, and any record reachable from two mental models is editable from both places using the same component — see `references/interconnection.md`.
8. **Verify with your eyes.** Screenshot every screen you touch, in both themes, with the browser MCP. Fix what the screenshot shows before declaring done. If no browser MCP is available, say so explicitly rather than silently skipping.

## The correction pass (run in this order)

Work in this sequence. Each step depends on the one before it — restyling pages before tokens exist produces a second mess.

### Step 1 — Audit
Screenshot every route, plus every dropdown, modal, and sheet in the open state, in both themes. Save to `docs/design/audit/`. Write `docs/design/UI_AUDIT.md`: per screen, the specific defect and the file/line responsible. Be concrete ("SelectContent has no background token, inherits transparent → white text on white"), never "needs polish". Also inventory every hardcoded color found.

### Step 2 — Tokens
Establish the token layer first: colors (dark-first), typography, spacing, radius, elevation, motion. See `references/design-tokens.md`. Build a `/design-preview` route that renders every token and every component in both themes — this is the mirror you check your work in for the rest of the pass.

### Step 3 — Status system
Implement `lib/statuses.ts` and `<StatusPill>` exactly as specified in `references/status-system.md`, then replace every status rendering in the app with it. Statuses are the primary information in this ERP; they get done before anything else.

### Step 4 — Option sets
Implement `option_sets` / `options` and the inline-create select (`references/option-sets.md`) before the forms that use them: supplier type, product category, tissu, expense subcategory, tags, cancellation reason. Seed defaults, wire the management screen in Settings → Options.

### Step 5 — Fields and forms
Build the field components and apply the form layout rules in `references/components.md`. Replace raw inputs everywhere, screen by screen.

### Step 6 — Tables, charts, navigation
Same reference file. Tables and charts are where this app is weakest: dense, sortable, filterable tables with URL-persisted state; charts that answer one question each.

### Step 7 — Per-section pass
Go section by section using `references/section-checklists.md`. One section per session; finish it completely (all states, both themes, keyboard, mobile where required) before moving on. Update `PROGRESS.md` after each.

### Step 8 — Final sweep

Before this, run the **interconnection sweep**: click every KPI, every chart segment, every rate, every count in the app and confirm each one navigates to the filtered records behind it. Confirm every record with two mental homes (expenses, ad spend, tasks, orders) is creatable and editable from both, through the same component.

Contrast check every status pill and muted text against its background in both themes. Keyboard-only walkthrough of one full order flow. Grep the whole codebase for hardcoded colors. Screenshot the app cold on a slow connection to verify skeletons, not blank panels.

## How to make choices when this skill is silent

Prefer the boring, legible option. This is a tool people use for eight hours, not a landing page. Density over whitespace, clarity over cleverness, one accent color used sparingly, motion only to explain a transition. If a decoration doesn't help someone find a number or take an action, cut it.

## References

- `references/navigation-ia.md` — **read first for any shell, routing or new-page work**: the v3 section map, canonical homes, breadcrumbs, hub pages, emoji policy, mobile bar.
- `references/design-tokens.md` — the dark-first token system, theming rules, typography, spacing.
- `references/status-system.md` — every status, its color, its icon, allowed transitions, the pill component contract.
- `references/components.md` — input inventory, form rules, table conventions, chart rules, navigation, states.
- `references/option-sets.md` — Notion-style selects: predefined options plus inline "create new", chip rendering, colors, archiving, merging.
- `references/interconnection.md` — drill-through, backlinks, shared forms, automatic money flow, command palette. Read this before building any page.
- `references/section-checklists.md` — acceptance checklist per section: Dashboard, Orders, Products, Finance, Contacts, Team & Rules, Settings.
