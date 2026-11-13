# Interconnection — one app, not a folder of tabs

The failure mode this file prevents: the same information existing in two places with two different implementations, and screens that dead-end instead of leading to the related data.

## Rule 1 — One record, many entry points, one component

A record is created and edited by **the same component wherever it appears**. Context only changes the pre-filled values and the default filter.

| Record | Entry points | Behavior |
|---|---|---|
| Expense | Product page → Expenses tab · Finance → Expenses · Supplier detail · Dashboard quick action | Same `<ExpenseForm>`; opening it from a product pre-fills that product (field stays editable); opening from a supplier pre-fills the supplier |
| Ad spend | Product page · Finance → Ad spend · Dashboard quick action | Same `<AdSpendForm>`, product pre-filled from context |
| Order | Orders → All · Product → Orders tab · Customer detail · manual create | Same `<OrderSheet>` |
| Task | Tasks board · Meeting detail · anywhere a task is mentioned | Same `<TaskForm>`, meeting link pre-filled when created from a meeting |
| Customer | Contacts · Order sheet (inline edit) | Same `<CustomerForm>` |

If you find yourself writing a second form for a record that already has one, stop and lift the existing one instead.

## Rule 2 — Every number is a link (drill-through)

No figure in this app is a dead end. Clicking it navigates to the filtered list that produced it, with filters visible as chips so the user understands where they landed and can widen the view.

- KPI card "Delivered: 126" → Orders filtered to delivered, same date range.
- Net profit on a product card → that product's Stats tab, same period.
- A wilaya row or map region → Orders filtered to that wilaya.
- An agent's confirmation rate → the orders they handled.
- An expense category total → Finance → Expenses filtered to that category.
- A customer's "3 returns" → their returned orders.
- Revenue on the Finance page → the delivered orders behind it.

Filters travel through the URL, so any drilled view can be pasted into WhatsApp and opens identically for a teammate with the right role.

## Rule 3 — Every detail view shows its relations (backlinks)

- **Product** → orders (by status), expenses by category, ad spend timeline, pricing scenarios, suppliers involved, related tasks.
- **Customer** → all orders with statuses, risk score with the history that produced it, total delivered value.
- **Supplier** → expenses paid to them with a running total, products they worked on, contact actions.
- **Order** → customer (with their other orders one click away), product, status history, agents involved, delivery fee source.
- **Meeting** → objectives (with carried-over ones marked), decisions, tasks created from it.
- **Task** → the meeting it came from, the product or order it concerns.
- **Agent (user)** → their orders, their rates, their open tasks.

Relations render as compact sections with a count and a "View all" that opens the filtered list — never a wall of a hundred rows inside a sheet.

## Rule 4 — Navigation preserves context

Detail views open as **sheets over the current list** so the user keeps their place; they are also addressable by URL for deep links. Stack at most two sheets deep (order → customer), with the back gesture closing one level. Escape closes the top sheet only. Never force a full page reload to see a related record.

## Rule 5 — Money flows in one direction, automatically

Nothing about a product's finances is typed twice:

- A **delivered** order becomes revenue for its product automatically. Nobody enters income by hand.
- A **returned** order automatically books the return fee as an expense on that product.
- Ad spend entered anywhere attributes to the product and appears in the product's cost, the dashboard spend, and Finance simultaneously.
- Monthly fixed fees are allocated to products by delivered-order share; the allocation method is stated in the UI ("Fixed fees allocated by share of delivered orders this month") so the number is never mysterious.
- The pricing calculator's **Real** column reads all of the above — it is a view, never a copy.

## Rule 6 — Global create and search

`⌘K` opens the command palette from any screen: search orders by phone or ID, products, customers, suppliers, tasks; and run create actions with the current page as context ("Add expense" from a product page pre-fills that product). A persistent `+` button in the header does the same for people who don't use keyboards.
