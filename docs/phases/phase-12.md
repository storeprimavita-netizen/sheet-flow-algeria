# Phase 12 — Section pass

**Read first:** CLAUDE.md, PROGRESS.md, `docs/design/DESIGN_SYSTEM.md`,
`docs/design/UI_AUDIT.md` (per-screen findings), and the `cod-ui-polish` skill +
references, especially `components.md`, `interconnection.md`,
`section-checklists.md`, `option-sets.md`. Phase 11 built the tokens, status
system, fields, tables, and nav — this phase **applies them section by section**.

## Goal

Restyle each section onto the phase-11 system and realign the sections that
drifted from the decided defaults (UI_AUDIT). Replace every raw `<input>`/native
`<select>` with a field/status component. **One section per session** — finish it
completely (all four states, both themes, keyboard, mobile where required, all
drill-throughs) before starting the next; append to PROGRESS.md after each.

## Sections (each is a session; use `section-checklists.md` as the checklist)

1. **Data-table foundation** (do first — the rest depend on it). Build
   `components/data-table/*` per `components.md`: sticky header/first-col,
   column-visibility, density toggle, URL-persisted filter+sort, server
   pagination, virtualize >200 rows, row→**sheet** (not full page), bulk-select
   floating bar, four states. This is the workhorse the app was weakest at.

2. **Orders** (All / Confirmation / Delivery). All: apply the table with the
   missing columns (thumbnail, qty, delivery fee, source badge, agent),
   duplicate-flag chip + "Duplicates only" filter, bulk status/assign/export,
   detail **sheet** with the status timeline. **Confirmation: switch from the
   card-stack to table + detail sheet** (decided default) — big click-to-call
   `tel:` link, risk pill (shield + reason on hover), previous orders, status
   buttons, "Save & open next", ↑/↓ nav. Delivery: dense table default + kanban
   toggle respecting `next[]`. Money block hidden for agent roles.

3. **Products.** **Switch list to the image-card grid default** (table as a
   persisted toggle): card = image/placeholder, status pill, price, delivery
   rate, net-profit color-coded, sparkline, kebab. Product page: product-context
   header (name/image/status pill + breadcrumb) across tabs. **Pricing: add the
   4th read-only "Real" column** + break-even indicator; inputs become
   Money/Percent fields with suffixes + live conversion. Expenses tab uses the
   shared expense form + ad-spend quick entry. Stats tab reuses dashboard
   components.

4. **Finance** (build the section stubbed in phase 11; admin-only). Overview
   (invested/revenue/net profit, spend by category & product, fixed fees, date
   filtered, drillable); Expenses & Ad spend reuse the **same** table+form as the
   product page (interconnection — same record from both places); Income derived
   from delivered orders, returns netted, **no manual entry**.

5. **Dashboard.** Sticky filter bar with field components + active-filter chips +
   URL state; KPI cards with sparkline, delta-vs-previous, **click-to-filter**;
   funnel with drop-off weight; **per-wilaya table + inline-SVG Algeria
   choropleth** beside it (hover syncs both ways, click filters); spend-by-
   category chart with icons; **ad-spend as a 4-field modal in a Quick-actions
   row** (remove the inline widget — UI_AUDIT dashboard finding); next-meeting +
   my-tasks cards. Charts follow `components.md` (one question each, empty/
   loading/error).

6. **Contacts.** Customers table (risk pill, drillable stats) + detail sheet
   with order-history timeline; Suppliers with type chip, click-to-call, linked-
   expenses running total.

7. **Team & Rules.** Rules blocks (rich text, read-only for non-admins);
   Meetings (objectives-before-held, carry-over, agenda copy); **Tasks kanban
   default** (list toggle); Performance bars; Users (role descriptions);
   Audit-log diff table. All with the status/field/table components.

8. **Settings.** Regroup the one-long-scroll into **grouped cards with section
   nav**: Workspace · Integrations (webhook URL copy, masked secret, health,
   test event) · Delivery fees (inline-edit + bulk paste) · Fixed fees ·
   Exchange rates · Engine rules · Meeting schedule · **Appearance (theme +
   density)**. Money via MoneyField; destructive actions separated.

9. **Option sets** (thread through wherever taxonomy selects appear). Implement
   `option_sets`/`options` + inline-create `OptionSelect` per `option-sets.md`;
   seed defaults; management screen in Settings → Options. Wire supplier type,
   product category, tissu, expense subcategory, tags, cancellation reason.

## Acceptance criteria (per section)

- No raw `<input>` or native `<select>` left in the section's feature code.
- Every status via `<StatusPill>`/`<StatusSelect>`; every money figure tabular +
  color-coded; four states present on every list/card/chart.
- Interconnection holds: every number/segment/rate drills through to filtered
  records; every two-home record (expense, ad spend, task, order) is editable
  from both places via the same component.
- Decided defaults honored (confirmation table+sheet, products card grid, tasks
  kanban, delivery table, pricing Real column).
- **Screenshot self-critique** both themes per section into `docs/design/audit/`;
  fix contrast/spacing/state gaps; note in PROGRESS.md what was shot and fixed.
- `npm run build` + `npm test` green after each section (never leave it broken).
