VERDICT: FIX
## Summary
Round 2 of the ORD-1 diff, checked by qa-reviewer (rolled-back backfill and fallback probes on the local DB, the gate) and ui-reviewer (app run in EN and AR, dark and light; screenshots `docs/design/audit/ORD-1/r2-*`). The gate gives GATE OK.
The DB core passes. The backfill with orders present (ties, NULL `placed_at`, an empty workspace) is ordered and gapless, and `updated_at` does not change. The `lag()` check takes 157 ms at 100k orders and raises when the order is wrong. The fallback re-seeds from max+1 (61, 62, then 63) with no 23505.
The first `db-reset.sh` failure was a PostgREST startup race (PGRST001, 503 from Kong at 23:51:00-04, reconnected at 23:51:12). The workspace trigger and the fallback cannot make workspace creation fail.
Still blocking: the palette "No results." message shows next to real results, the double focus ring from review-1 #8 is still there, and the tests the brief requires are still missing.

## Findings (ranked)

1. **MEDIUM: `src/components/command-palette.tsx:89`. "No results." shows while the query is non-empty, directly above the order and customer items.**
   - Failure: type `#0001`, `12` or `Client Dup` and `[cmdk-empty]` renders above the Search group. This happens in EN and AR, dark and light, and in the agent session.
   - Cause: cmdk does not count `forceMount` items as matches. Group `forceMount` (line 119) did fix the items being hidden.
   - Fix: render `<CommandEmpty>` only when `!query.trim()`. Or drop it and render a manual empty state only when the query is empty and nothing matches.

2. **MEDIUM (unfixed from review-1 #8): `src/components/data-table/data-table.tsx:339` and `:360`. Keyboard focus draws two rings.**
   - Failure: the row ring and a second `ring-2 ring-inset` on the sticky td both draw. The frozen cell shows as a box inside the row ring (seen on `#0060` in dark and `#0045` in light).
   - Fix: remove the td ring at :360. If the sticky cell clips the row ring, give the focused row a higher stacking context, or use an outline on the `tr` instead.

3. **MEDIUM (missing tests the brief requires, carried over from review-1, none added this round): `src/lib/orders.order_seq.rls.test.ts`.** See "Missing tests" below.

4. **LOW: `supabase/migrations/00050_order_seq.sql:9`. `service_role` still has full write on `order_counters`.**
   - Failure: setting `next_seq=1` makes every later insert fail with 23505, so webhooks retry forever.
   - Fix: `revoke insert, update, delete, truncate on order_counters from service_role`. The trigger is security definer, so it does not need these grants.

5. **LOW: `00050:69-76`. An insert with an unknown `workspace_id` fails with 23502 (not-null on `order_seq`) instead of 23503 (FK).**
   - Fix (optional): raise with `errcode = '23503'`.

6. **LOW: `scripts/db-reset.sh:14` and `scripts/seed-dev.ts:114`. The seed starts before PostgREST is ready, and `ensureWorkspace` ignores the `select` error.**
   - Failure: the first reset fails at random with a misleading error.
   - Fix: poll `/rest/v1/` until it returns 200 (about 30 s at most) before seeding, and throw on the select error.

7. **LOW (UI polish): the frozen column has no scroll-edge divider.** When scrolled, text from the next column bleeds at the edge (".6" from "Placed at").
   - Fix: add a `border-e` with the border token on the sticky td and th.

## Missing tests
- `swap_order` replacement, manual `createOrder` and a webhook insert should each get an `order_seq`.
- Fallback: delete the counter row, insert, and assert the result is max+1.
- An `ON CONFLICT DO NOTHING` insert and what it does to the counter, asserting the documented behaviour.
- The `workspaces.update({next_seq})` test still passes only through PGRST204. Replace it with REST writes to `order_counters` as admin and as anon, and assert code `42501`, not just `error != null`.
- The search query error path (`orders/all/page.tsx:95`).
- UI not covered this round: 390 px; AR light frozen column; frozen column states on delivery and product orders; the order sheet; Escape and focus return on the palette.
