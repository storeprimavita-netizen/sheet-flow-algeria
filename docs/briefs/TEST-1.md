risk: low · surface: none · lane: shell

# TEST-1 — live test isolation

Goal: every live suite builds and removes its own data, so `scripts/gate.sh` passes twice in a row with no `db-reset.sh`.

## Definition of done
- `scripts/db-reset.sh` once, then `scripts/gate.sh --fast` twice: both GATE OK, same test count.
- `cash.test.ts` no longer reads seed orders or depends on which orders lack a cash row.
- After a gate run, row counts of orders, cash_collections, customers, workspaces equal those before (check with a count query).
- No test deleted or weakened; no assertion changed; gate.sh, vitest.config.ts untouched.

## Findings (real code)
- Culprit: `src/lib/cash.test.ts` beforeAll picks the first 2 seed orders with no cash row; the tests then insert cash rows for them, and cleanup deletes only `created` ids. The `created` list is never filled for rows inserted by order id (rows at lines ~50-95 and raw-SQL inserts at ~81/93 leak). A second run finds no free orders and throws.
- Also leaky (check, fix if confirmed): `rls.test.ts` creates the named workspace "RLS Test WS2" (reused by name, afterAll only signs out, so it persists by design; it also nulls `assigned_confirmation_agent` on a seed order in a beforeAll). Make it idempotent or restore the value; do not change assertions.
- `webhook.test.ts` uses the seed product and cleans its order/customer/event: OK. `stock-stages`, `kpi`, `zrexpress-sync` already use their own workspace and delete it in afterAll: OK.

## Files and change
1. `src/lib/cash.test.ts` (setup/cleanup only): beforeAll creates workspace ws1 + product + 2 orders (pattern from `zrexpress-sync.test.ts`: insert workspace, product, orders with the service client) and ws2; afterAll deletes ws1 and ws2 (cascade removes orders and cash rows; if a cash FK blocks, delete cash_collections by workspace_id first). Replace the `ws1` seed lookup; keep all tests as they are.
2. `src/lib/rls.test.ts` (only if the leak is confirmed): in afterAll delete the WS2 rows it created, or record and restore the seed order's assignment. Keep names/assertions.
3. Optional: a tiny shared helper is NOT needed; do not add one.

## Steps (each committed with scripts/step.sh)
1. Isolate cash.test; run it twice alone.
2. Fix rls.test leak if real; run twice.
3. `db-reset.sh`, then `gate.sh --fast` twice; compare row counts; note in PROGRESS.md.

## Acceptance tests
All existing tests by name, unchanged: cash.test (3 suites), rls.test. New proof = the double gate run.

## Edge cases / assumptions
- Orders insert triggers (stock holds, audit): a bare order with product and quantity 1 works in zrexpress-sync.test, so reuse its shape.
- Cascade on workspace delete is relied on by stock-stages/kpi already.
- Parallel vitest files share the DB: unique names (`crypto.randomUUID()`) per workspace.
- No new DECISIONS row needed (D40: decided).
