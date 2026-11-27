# CONF-6 — Apply an offer during a confirmation call

`risk: high` · `surface: ui,security` · `lane: orders`

Goal — Let a confirmation agent apply an admin-defined quantity offer to an eligible order and quote the exact amount the customer will pay.

## Decision required before build

- The plan lists `M: –` and depends on STORE-3. `supabase/migrations/00025_agent_permission_matrix.sql` blocks agent edits to `orders.quantity` and `orders.sale_price`, including through the existing status RPC. `src/lib/rls.test.ts` verifies that guard. `supabase/migrations/00077_store_offers_forms.sql` restricts offer configuration to admins. There is no session-scoped agent action that applies an offer to an order.
- `confirmation-sheet.tsx` displays `sale_price × quantity`. A three-piece offer for 10,000 DZD needs the exact merchandise amount and the line-aware stock reconciliation specified in D99 and the pending STORE-4 brief. `00044_variant_stock_wiring.sql` reconciles the current single-variant representation. STORE-4's brief describes an admin-only edit path.
- Recommended owner decision — add STORE-4 as a prerequisite and mark CONF-6 as requiring a migration for a narrowly scoped offer operation. Keep the D10 direct-edit restrictions and D102 receipt history. A UI-only change cannot meet the current spec.

## Definition of done after the decision

- The confirmation sheet shows current, applicable quantity offers for the order's product. An authorized agent can select the pieces, see the quantity, exact merchandise amount and separate delivery fee, then apply the offer after the buyer agrees. Free delivery and manually entered prices are outside scope (CONF spec, D14, D60, D61).
- Only an active role with access to the pre-dispatch order can quote and apply. The server checks assignment or queue access, workspace, product, offer validity, selected variants and dispatch state again at save. A changed quote requires fresh agreement. The operation atomically saves the offer and fulfilment lines, updates stock through the existing reconciliation path and preserves the first checkout receipt (D99, D102).

## Files and step order

1. After STORE-4 ships, identify its final order update and reconciliation entry points. In the next numbered `supabase/migrations/` file, extend that path with an authenticated, order-scoped operation accepting an order ID, offer ID, piece selection and quote precondition. Lock and recheck the parent and current pricing inputs, then apply the server-calculated quote in one transaction. Preserve role and workspace checks, audit attribution, and deny direct field edits and anonymous execution. Document the RPC in `docs/DB.md` and regenerate `src/lib/supabase/database.types.ts` with `scripts/gen-types.sh`.
2. Add `src/app/(app)/app/sell/confirmation/actions.ts` for Zod validation, role checks, session-client quote/apply calls and refresh of affected order data. Reuse STORE-4 pricing and `src/lib/store/offer-price.ts` (`unitPrice`, `piecesCharge`) so the cap and mixed-size rules cannot drift.
3. Update `src/app/(app)/app/sell/confirmation/{page.tsx,confirmation-table.tsx,confirmation-sheet.tsx}` with the data and controls for the opened sheet. Show quote, pending, stale and failure states. Keep arrow-key queue navigation out of the offer controls. Add EN and AR strings in `src/messages/{en,ar}.json`.
4. Run the full gate with live RLS and get independent security and UI reviews before ship.

## Acceptance tests and screenshots

- `src/lib/confirmation-offers.rls.test.ts` — eligible agent applies an offer; other workspace, unassigned inaccessible order, shipped order and direct price or quantity update are rejected. Expired or switched offers and simultaneous dispatch cannot commit a stale edit. Repeated apply has one stock effect.
- `src/app/(app)/app/sell/confirmation/actions.test.ts` — validates IDs and piece counts, reports a stale quote, and displays an exact server quote of 10,000 DZD for a three-piece mixed-size fixture. Check the lower individual-price cap, legacy orders, unchanged delivery fee and immutable receipt.
- Screenshot the confirmation sheet with selectable offers, quoted total, and an ineligible order in dark and light themes, EN and AR, at desktop and 390 px. Verify keyboard interaction with the sheet and offer controls.
