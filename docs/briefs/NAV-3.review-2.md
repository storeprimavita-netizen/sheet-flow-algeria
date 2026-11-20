VERDICT: PASS

## Summary
Review-1 findings 1–3 are fixed in e151d50. Customers and courier-cash titles now match the nav labels (EN and AR), the cross-section Customers/Suppliers tab bar is gone, and the courier-cash tabs set `aria-current`.
Suppliers is still easy to find: it has a Money sidebar leaf, appears in the palette with a "new supplier" action, and stays hidden from agents. Dropping the cross-link follows navigation-ia.md.
Redirects were re-checked live: single 308s, query strings kept, and `finance/income` lands on `courier-cash?tab=income`. `scripts/gate.sh` gave GATE OK (1021 tests).
Every remaining item is low: the two leftovers from review 1, the review-1 extra tests, and part of the screenshot matrix.

## Findings (ranked)

1. **Low — `src/components/admin-guard-layout.tsx:9`, `src/app/(app)/app/sell/orders/new/page.tsx:10`, `catalog/pricing/page.tsx:15`, `catalog/products/[id]/pricing/page.tsx:12`, `app/not-found.tsx:19`** (carried over from review-1 #4). Refused users are still sent to the legacy `/app/orders` role-redirect page. A delivery agent on `/app/money/suppliers` goes to `/app/orders` and then to `/app/sell/shipping`, which is two hops. The brief allows this.
   Fix (optional): add a role-home helper that returns `/app/sell/confirmation` or `/app/sell/shipping`.
2. **Low — `docs/DB.md:138`** (carried over from review-1 #5). It still says `orders/actions.ts`.
   Fix: change it to `sell/orders/actions.ts`.
3. **Low — `src/app/(app)/app/money/courier-cash/page.tsx` subtitle.** The Income tab is a per-product P&L, but the page subtitle says "Cash couriers collected and still owe you." The brief ordered this merge.
   Fix: reword the subtitle so it covers both tabs.
4. **Low — `courier-cash/_components/collections-tab.tsx`.** Order refs such as `#0050` are plain text, so you cannot click through to the order.
   Fix: link each ref to `/app/sell/orders/<id>`.
5. **Low — mobile top bar at 390 px.** The crumb is cut short ("Cour…", "Sup…").
   Fix: let the crumb take the free width, or show only the leaf name.
6. **Low, likely pre-existing — `/app/sell/customers` in AR.** The Name column is narrow, so names wrap onto 2–3 lines.
7. **Low — the Expense form does not link its supplier.** navigation-ia.md:60 says Suppliers is reached from the Expense form, but no link exists there.
   Fix: link the supplier field to `/app/money/suppliers/[id]`.

Review-1 #6 (agent can open Customers) is not a bug: navigation-ia.md:26 gives agents read access to Customers.

## Missing tests (low — every test the brief names exists and passes)
- `next-config-redirects.test` should assert first-match resolution order.
- It should also cover `/app/finance/income` → `/app/money/courier-cash?tab=income` and a case where the query string survives.
- A test should state that bare `/app/orders` is deliberately absent from the redirect table.
- The courier-cash `?tab=` handling needs tests for the default (`collections`) and the whitelist (`collections|income`).

## Screenshot gaps (still open)
- 390 px for `/app/sell/orders/<id>` and for the `/app/catalog/products/<id>` tabs.
- Light theme for the moved Sell/Catalog pages other than customers and suppliers.
- Courier-cash AR light, and the EN income tab.
- Customers AR light, and suppliers EN dark.

Review shots: `docs/design/audit/NAV-3-review-2/`.
