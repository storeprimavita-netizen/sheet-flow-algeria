VERDICT: FIX
## Summary
Diff round 1 for ORD-1, checked by qa-reviewer (migration 00050 run against real orders inside a rolled-back transaction, PostgREST probes, a concurrency test) and ui-reviewer (app run, screenshots in `docs/design/audit/ORD-1/`).
The DB core holds up. Backfill order is correct per workspace, `updated_at` does not change, there are no gaps, the counter is closed to clients (42501), `order_seq` and `workspace_id` cannot be changed by any role, and concurrent inserts stay serialized and gapless when one rolls back.
Two problems block the pass. ⌘K order search never shows its item, and customer search broke the same way. The ordering check inside the migration is O(n²) and runs while the migration holds an ACCESS EXCLUSIVE lock on `orders`.

## Findings (ranked)

1. **HIGH: `src/components/command-palette.tsx:119-138`. The ⌘K order search item is never visible.**
   - Failure: type `#0046` and the palette shows only "No results". Both `orders:` and `customers:` items are in the DOM, but cmdk sets `hidden` on their parent `[cmdk-group]`, because no item in it matches the filter. `forceMount` on an item does not stop its group from hiding. Customer search through the palette is now broken too, which is a regression.
   - Fix: add `forceMount` to `<CommandGroup heading={t("cmd.search")}>`. Re-test in EN and AR: the empty message must not show while the query is non-empty, and Enter must route to `/app/orders/all?q=…`.

2. **MEDIUM: `supabase/migrations/00050_order_seq.sql:46-50`. The ordering assertion self-joins on `a.order_seq < b.order_seq`, which is O(n²) per workspace.**
   - Failure: measured 13.1 s at 20k orders in one workspace, roughly 5 min at 100k. All of that time runs under the ACCESS EXCLUSIVE lock taken by `ADD COLUMN` in the same transaction, so the app and webhooks stall during the remote push.
   - Fix: compare each row with the previous one, using `lag(...) over (partition by workspace_id order by order_seq)` on the key `(coalesce(placed_at,created_at), created_at, id)`, and raise if the previous key is greater than the current one.

3. **LOW: `00050:73-77`. The fallback branch of the trigger leaks whether a workspace exists.**
   - Failure: an insert with an unknown `workspace_id` gets an FK error on `order_counters`, with the function source in CONTEXT. A foreign workspace that exists gets the RLS error instead.
   - Fix: take the fallback only `if exists (select 1 from workspaces where id = new.workspace_id)`.

4. **LOW: `00050` fallback. If the counter row is missing or reset, every insert fails with 23505.**
   - Failure: the fallback restarts at 1, and `service_role` can still write `order_counters`. Webhooks would then retry forever.
   - Fix: seed the fallback from `coalesce(max(order_seq),0)+1`. Consider revoking write on the counter from `service_role`.

5. **LOW: "gapless" is not true for upserts.**
   - Failure: `INSERT … ON CONFLICT DO NOTHING` burns a number (measured 71→72 with no row inserted). No caller does this today, but STORE-4 might.
   - Fix: record this in `docs/DB.md` (or ban upsert on `orders`), and correct the "gapless" claim.

6. **LOW: `src/lib/order-search.ts:3`, `orders/all/page.tsx:72`. A query of 1 to 9 digits only matches `order_seq`, so partial phone numbers (for example `123456`) never match a phone.**
   - This follows the brief.
   - Fix: also OR in a phone ilike when the query has 5 or more digits. Also, `_` is still an ilike wildcard. That is harmless.

7. **LOW (UI): the number column header says "Orders" / "الطلبات"** in orders-all, confirmation, delivery and product-orders. Rename it to "Order #" / "رقم الطلب".

8. **LOW (UI): `src/components/data-table.tsx`. On keyboard focus, the sticky `td` and the `tr` each draw a ring**, which shows as a double border at the edge of the frozen cell. Draw the ring once.

## Missing tests
- `swap_order` replacement, `createOrder` and a webhook insert should each get an `order_seq`. The brief requires this; `src/lib/orders.order_seq.rls.test.ts` does not cover it.
- Fallback branch: delete the counter row, then insert.
- An `ON CONFLICT` insert, and what it does to the counter (document the expected behaviour).
- The `workspaces.update({next_seq})` test passes only through PGRST204 (the column does not exist), so it proves nothing. Replace it with a REST write to `order_counters` as admin and as anon, and assert 42501.
- The search query error path (`orders/all/page.tsx:90`) is not tested.
- UI was not covered for these: EN dark/light on confirmation, delivery, cash, contacts, product orders and the order page; AR light on every screen; 390 px on delivery, cash, contacts, the order page and product orders; the order sheet; the swap badge; an agent session (no palette order entry). After the fixes, re-check the palette in EN and AR, both themes.
