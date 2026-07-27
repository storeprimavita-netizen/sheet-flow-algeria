# Per-section acceptance checklists

One section per session. A section is done only when every box below is true in **both themes**, with screenshots saved.

## Dashboard
- [ ] Sticky filter bar: date range · product · wilaya · source · agent · status; URL-persisted; active filters as removable chips; remembered per user.
- [ ] KPI cards: Revenue · Spend · Net profit · Confirmation rate · Delivery rate · Orders. Each: large tabular number, label, delta vs previous period with arrow, sparkline. Clicking a card filters the section below.
- [ ] Funnel: received → confirmed → shipped → delivered, counts + drop-off %.
- [ ] Profit and spend over time.
- [ ] Delivery rate per wilaya: **sortable table with in-cell rate bars beside a small choropleth map of Algeria**. Table is the source of truth for numbers; the map is for spotting patterns. Map rules: lightweight inline SVG of the 58 wilayas (no heavy mapping library, no tiles), colored by delivery rate on a 4–5 step scale from token colors, hovering a wilaya highlights its table row and vice-versa, clicking either filters the dashboard to that wilaya, wilayas with too few orders render as "no data" neutral rather than a misleading extreme, and "stop shipping" wilayas get a visible outline. Map collapses below the table on narrow screens.
- [ ] Red flag column for "stop shipping" in the table.
- [ ] Per-agent and per-product rate tables.
- [ ] Spend by category breakdown with values in the legend.
- [ ] Quick actions row: **Add ad spend** (4-field modal: product, date, amount + currency, test/scaling), New order, Add expense. Ad spend is never an inline widget stuffed into a chart area.
- [ ] Next meeting card + my open tasks card (admin).
- [ ] All four states on every card and chart.

## Orders — All
- [ ] Columns: order # · date · customer + phone · product thumb + name · qty · price · delivery fee · wilaya · source badge · confirmation pill · delivery pill · agent.
- [ ] Duplicate flag chip on the row and a "Duplicates only" filter.
- [ ] Bulk actions bar; CSV export respects current filters.
- [ ] Detail sheet: status timeline with actor + duration per stage, customer block, money block (hidden for agent roles).

## Orders — Confirmation
- [ ] Table list; click a row to open the detail sheet (decided — no separate call-mode screen).
- [ ] Sheet order: name → big `tel:` call link → risk badge with reason on hover → previous orders → product/qty/price → large status buttons → comment box.
- [ ] "Save" and "Save & open next"; ↑/↓ moves between rows; handled rows leave the pending filter.
- [ ] Realtime: new webhook orders arrive as a "1 new order" pill, never a re-sort under the cursor.
- [ ] Usable on a phone.

## Orders — Delivery
- [ ] Dense table by default, groupable by stage; optional kanban toggle respecting allowed transitions.
- [ ] Quick status-advance button per row; delayed and returning rows visually distinct.

## Products
- [ ] **Grid of image cards is the default view**; a dense table is available as a toggle and persists per user. Card: image (fills the top, consistent aspect ratio, placeholder when missing), name, status pill, sale price, delivery rate, net profit color-coded, 30-day sparkline, kebab for quick actions. Cards keep a fixed height so the grid stays even.
- [ ] Tabs: Overview · Pricing · Expenses · Orders · Stats.
- [ ] Pricing: Best / Medium / Worst editable columns + **Real** read-only column from live data; live recalculation; profit green, loss red; break-even line ("needs ≥ 58% delivery rate to profit at these inputs").
- [ ] Expenses: **the same components as Finance → Expenses**, pre-filtered to this product and pre-filling it in the form. Category chips with icons, totals per category, ad-spend quick entry pinned at top.
- [ ] Income appears automatically from delivered orders — never entered by hand — and the tab shows spend, income, and net profit for this product side by side.
- [ ] Stats: reuses the dashboard KPI/funnel/wilaya components — no parallel implementations.

## Finance
- [ ] Subsections: Overview · Expenses · Ad spend · Income.
- [ ] Overview: invested vs revenue vs net profit for the period, spend by category, spend by product, monthly fixed fees line, all date-range filtered.
- [ ] Expenses: the **same table and form component used on the product page**, unfiltered here and product-filtered there. Adding an expense from either place creates the identical record.
- [ ] Ad spend: same shared component; daily entries listed with product, amount + currency, test/scaling flag; quick-add always one click away.
- [ ] Income: delivered orders as revenue rows, grouped by product, with returns and return fees shown against them. **Nothing here is typed by hand** — it derives from orders.
- [ ] Every total drills through to the records behind it.
- [ ] Section invisible and unreachable for confirmation and delivery agents (verified at RLS level, not only in the UI).

## Contacts
- [ ] Tabs: Customers · Suppliers.
- [ ] Customers: name, phone (click-to-call), wilaya, orders, delivered, returned, risk pill, last order. Detail sheet with full order timeline.
- [ ] Suppliers: type chip (studio `camera`, atelier `scissors`, emballage `package`, other), phone, location, notes, linked expenses total.

## Team & Rules
- [ ] **Rules**: blocks for Store rules · Product selection criteria · Roles & duties. Rich text, last edited by/when, read-only for non-admins but visible to all.
- [ ] **Meetings**: Upcoming / Past. Card shows date, time, attendees, state (Planned → Ready → Held).
- [ ] Objectives checklist per meeting, each with owner; **cannot mark Held until every objective is checked or deferred**; deferred ones appear in the next meeting tagged "carried over".
- [ ] Decisions/notes field; tasks created from the meeting stay linked to it.
- [ ] "Copy agenda" produces plain text suitable for pasting into WhatsApp.
- [ ] **Tasks** page: **kanban board by status is the default** — columns Todo / Doing / Blocked / Done, drag between columns (keyboard-accessible alternative required: a status select on each card), card shows title, owner avatar, due date (red when overdue), priority dot, and a link chip when it came from a meeting. Column headers carry counts. Filters above the board: owner, priority, due, product. "My tasks" is the default filter. A list view is available as a toggle for scanning many tasks.
- [ ] **Performance**: per agent — confirmation rate, avg time to confirm, orders handled, delivery rate; date-range filtered.
- [ ] **Users**: invite by email, role select with a plain-language description of what each role can see, active toggle.
- [ ] **Audit log**: filterable, old → new diff inline.

## Cross-cutting (verify on every section)
- [ ] Every KPI, rate, count, and chart segment drills through to its filtered records, with the applied filters visible as chips.
- [ ] Every detail view shows its relations with counts and a "View all" (product → orders/expenses/suppliers/tasks, customer → orders, supplier → expenses, meeting → tasks).
- [ ] Records with two homes (expenses, ad spend, orders, tasks) use one shared component in both places.
- [ ] ⌘K palette searches orders by phone/ID, products, customers, suppliers, tasks, and creates records with the current page as context.
- [ ] Every taxonomy dropdown offers `+ Create "…"` inline and renders chips identically in trigger, options, tables, and filters.

## Settings
- [ ] Options manager: every option set listed, options reorderable, recolorable, renamable, archivable, mergeable, with usage counts.
- [ ] Grouped cards: Workspace · Integrations · Delivery fees per wilaya (inline-editable, bulk paste) · Monthly fixed fees · Exchange rates · Engine rules (return fee, duplicate window, risk weights, stop-shipping threshold) · Meeting schedule · Appearance (dark default / light / system, density).
- [ ] Integrations: copyable webhook URL, masked secret with reveal, health indicator ("Last event 4 min ago" / "No events in 3 days"), test event button.
