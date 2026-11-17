# Navigation & information architecture (v3)

Supersedes the "exactly six sections" list in `docs/SPEC.md` §1 and the old
Navigation block in `components.md`. Visual style is unchanged (Slate & Emerald);
this file changes **where things live and how people know where they are**.

## What was wrong (owner feedback, confirmed in `src/components/nav-model.tsx`)

- Eight flat top-level sections and growing; no grouping by the job being done.
- Money lived in three places (Orders → Cash, Finance → Income, Finance → Accounts);
  Products and Stock were siblings; Users and Audit hid under Settings.
- The accordion hid every other section's children, so people lost their place.
- No breadcrumb, no "what is this page for" line, hub URLs silently redirected.
- Related sections did not point at each other, so the same thing looked like
  two different things.

## The map — five workspaces, named after the job

Sidebar = `Home`, then five labelled groups, then `Settings` pinned at the
bottom. Group labels are always visible text (not icons); every item has a
Lucide icon **and** a text label. Counters as today.

| Group (EN / AR) | Items | Who |
|---|---|---|
| **Home** / الرئيسية | Admin: dashboard. Agent: "My day" (my queue, my tasks, next meeting, my numbers — no money) | all |
| **Sell** / المبيعات | Confirmation · Shipping · All orders · Customers · Abandoned checkouts | agents see Confirmation + Customers (read) |
| **Catalog** / المنتجات | Products · Stock · Research (spied products) · Pricing calculator | admin |
| **Store** / المتجر | Pages · Forms & offers · Discounts · Tracking (pixels) · Store settings | admin |
| **Money** / المالية | Overview (P&L) · Accounts (DZD, USDT) · Expenses · Ad spend · Courier cash · Suppliers | admin only |
| **Team** / الفريق | Tasks · Meetings · Rules · Performance | all (Performance admin) |
| **Settings** / الإعدادات (bottom) | Workspace · Users & roles · Integrations (carriers, Telegram, AI connector) · Delivery fees · Options & labels · Audit log | admin |

Rules:
- **Five groups maximum.** A new feature joins a group; it never becomes a
  ninth top-level item. If it fits nowhere, the grouping is wrong — raise it.
- **Groups stay open.** No accordion that hides siblings. The whole map is
  visible at once on desktop (it fits: ≤ 24 rows). Each group can be collapsed
  by the user and the choice persists; the group holding the active page is
  always open. The icon rail keeps group separators and tooltips with labels.
- **One home per thing.** Every record type has exactly one canonical list URL
  (table below). Other places show a filtered embed plus an "Open in <home>"
  link — they never grow their own copy of the list.
- **Role decides the map, RLS decides the data.** An agent's sidebar shows
  only what they can use; nothing is rendered disabled.
- **Old URLs keep working.** Every moved route gets a permanent redirect in
  `next.config.ts` so bookmarks and WhatsApp-pasted links survive.

### Canonical homes and moves

| Thing | Canonical home (new URL) | Was | Also surfaces in (embed + link back) |
|---|---|---|---|
| Confirmation queue | `/app/sell/confirmation` | `/app/orders/confirmation` | Home counters |
| Shipping tracking | `/app/sell/shipping` | `/app/orders/delivery` | Order sheet |
| All orders | `/app/sell/orders` | `/app/orders/all` | Product → Orders tab, Customer detail |
| Customers | `/app/sell/customers` | `/app/contacts` | Order sheet, confirmation hover card |
| Products / Stock | `/app/catalog/products`, `/app/catalog/stock` | `/app/products`, `/app/stock` | – |
| Research, Pricing | `/app/catalog/research`, `/app/catalog/pricing` | `/app/products/planner` | Product → Pricing tab |
| Courier cash | `/app/money/courier-cash` | `/app/orders/cash` + Finance → Income | Dashboard tiles |
| Accounts, Expenses, Ad spend, Overview | `/app/money/*` | `/app/finance/*` | Product tabs (filtered) |
| Suppliers | `/app/money/suppliers` | `/app/contacts/suppliers` | Expense form |
| Users, Audit | `/app/settings/users`, `/app/settings/audit` | same | – |

(Folders may keep their current names behind route groups if a rename is too
wide for one task; the **URLs and labels** above are what users see.)

## Always answer "where am I and what is this for"

Every page under `/app` renders, through one shared component:

1. **Breadcrumb** in the top bar: `Group › Page › Record` — each part a link.
2. **Title** = the same words as the sidebar label (one name per thing, in
   both languages; never "Delivery" in the nav and "Shipping" on the page).
3. **Purpose line** (the `subtitle` of `PageHeader`, now required): one plain
   sentence saying what you do here — "Call new orders and confirm them."
4. **Related links** row under the header when the page has a sibling people
   confuse it with: Expenses ↔ Ad spend ↔ Accounts; Stock ↔ Products;
   Confirmation ↔ Shipping; Research ↔ Pricing. Max three.
5. The active sidebar item, the breadcrumb and the title always agree.

Group roots (`/app/sell`, `/app/money`, …) are real hub pages, not silent
redirects: a short grid of the group's pages with their purpose line and live
count. They double as the mobile entry point.

## Emoji and icons

- Navigation, buttons, headings, table headers, status pills: **Lucide icons
  only**, one stroke weight. No emoji — they render differently per device,
  break dark/light contrast and do not mirror in RTL.
- Emoji are welcome in **content people author**: option labels (categories,
  tags, cancellation reasons, expense subcategories), saved view names, task
  titles, rules documents, notification templates. `options` and saved views
  get an optional `emoji` field with a picker; it renders before the label in
  `<Chip>` and in view tabs.
- System status **keys and colors** stay fixed; an admin may override the
  displayed label per workspace (Settings → Options & labels), emoji allowed.

## Mobile (agents work on phones)

Under 768 px the sidebar becomes a bottom bar with the role's four most-used
destinations + "More" (opens the full map as a sheet). Admin: Home · Confirmation
· Orders · Money · More. Agent: My day · Confirmation · Tasks · More.

## Borrowed rules (sources in `docs/TOOLING.md`)

- ≤ 5 top-level groups; ≤ 4 choices at a decision point; 8+ is overload.
- No icon-only navigation; one icon library; always show current location.
- The theme contributes type, palette and density — never layout or navigation.
- Filters, tabs, pagination and the open sheet live in the URL.
- `<Link>`/`<a>` for navigation, buttons for actions; icon buttons need `aria-label`.
- Destructive actions need a confirm or an undo. Modals are the last resort.
- Skeletons, not spinners; an empty state teaches what the page is for and
  offers the first action.
- No nested cards, no hero-metric template, motion 150–250 ms and only to
  explain a transition. Check directional icons under RTL.

## Acceptance (ui-reviewer checks these)

- A new admin finds "where do I record a USDT payment" and "where do I see
  what ZR owes me" from the sidebar alone, without opening two wrong pages.
- An agent's sidebar has no admin-only item; every old URL redirects.
- Every `/app` page shows breadcrumb + title + purpose line, in AR and EN.
- ⌘K finds every page by its new and its old name.
