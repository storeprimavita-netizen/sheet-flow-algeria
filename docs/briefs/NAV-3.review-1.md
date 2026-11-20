VERDICT: FIX

## Summary
Redirects are solid: 26 old URLs each give a single 308 to the canonical URL, with query strings kept and `finance/income` sent to `courier-cash?tab=income`. A crawl of 254 `/app` links found no 404s or legacy hrefs. Agent role redirects still land on `/app/sell/confirmation`.
Two medium IA/copy issues remain. Both come from the move: the shared Customers/Suppliers tab bar now crosses sections, and the page titles do not match the nav labels.
Screenshot coverage is still partial: 4 screens in the review plus the builder's. The full light/dark × EN/AR × 1280/390 matrix was checked by DOM only.

## Findings (ranked)

1. **Medium — `src/app/(app)/app/sell/customers/page.tsx:102`.** The header says "Contacts" / "جهات الاتصال" (`contacts.title`). The sidebar leaf and crumb say Sell › Customers / العملاء. On the new URL, the page names a section that no longer exists.
   Fix: use a `customers.title` key (en+ar) that matches the nav label, or reuse the nav-model label key.

2. **Medium — `src/app/(app)/app/sell/customers/tabs.tsx:13-14` (also rendered on `/app/money/suppliers`).** One tab bar links Sell › Customers and Money › Suppliers. Clicking a tab moves the sidebar group, active leaf and crumb to the other section, so two pages in different sections look like siblings. `navigation-ia.md` places them in separate sections, so a section-crossing tab control contradicts the IA (tabs = views of one thing).
   Fix: remove the shared `ContactTabs` from both pages. Each page keeps its own header. If the link is still wanted, add a plain cross-link in the subtitle or empty state ("Suppliers are in Money").

3. **Low — `src/app/(app)/app/money/courier-cash/page.tsx:20`.** The title uses `cash.title` ("تسوية النقد" / cash settlement) while the nav and crumb say "Courier cash" / "نقد شركة التوصيل".
   Fix: make the merged page's title match the nav label. Also, the tab bar has no `aria-current` on the active tab; add it.

4. **Low — `src/components/admin-guard-layout.tsx:9` and `src/app/(app)/app/sell/orders/new/page.tsx:10`.** The guards still target legacy `/app/orders`. The same target appears in `catalog/pricing/page.tsx:15`, `catalog/products/[id]/pricing/page.tsx:12` and `app/not-found.tsx:19`. A refused agent therefore takes two hops. This is allowed by the brief because `/app/orders` is kept as the role redirect, but it is the only old prefix left in app code.
   Optional fix: a role-home helper (`/app/sell/confirmation` | `/app/sell/shipping`).

5. **Low — `docs/DB.md:138`.** It still references `orders/actions.ts`; the file is now `sell/orders/actions.ts`.

6. **Note (likely pre-existing, not counted)** — an agent can render `/app/sell/customers`; only the nav hides it. The page code is unchanged from v3. Confirm against v3 and file it separately if real.

## Missing tests
- `next-config-redirects.test`: the chain test substitutes one literal for `:id` / `:path*` and checks for no other match. Make it assert first-match resolution order.
- No test asserts that bare `/app/orders` is intentionally absent from the table (it is handled by the role-redirect page).
- No test checks that `/app/finance/income` → `/app/money/courier-cash?tab=income`, or that query strings survive (`/app/orders/all?status=new` → `/app/sell/orders?status=new`).
- No test checks that the courier-cash page defaults to `collections` and accepts only `collections|income` for `?tab=`.

## Screenshot gaps (to close in the fix pass)
Not yet captured:
- light theme for courier-cash and the moved Sell/Catalog pages;
- EN for courier-cash;
- 390 px for `/app/sell/orders/<id>` and `/app/catalog/products/<id>` tabs;
- the delivery agent's `/app/sell/shipping`.

Review shots: `docs/design/audit/NAV-3-review/`.
