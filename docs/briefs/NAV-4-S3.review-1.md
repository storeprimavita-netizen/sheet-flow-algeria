VERDICT: PASS

## Summary
Reviewer: qa-reviewer (owasp-security lens), diff `git diff v3...v3-NAV-4-S3`, live local DB with 00076 applied.
anon and PUBLIC execute 0 public functions. authenticated and service_role access is the same as before 00076. Every function they cannot execute was revoked on purpose by an earlier migration, and no function had a NULL ACL. All 18 `.rpc(` targets still match their caller role.
Guard can only raise for postgres-owned routines, so it cannot block a remote push for things the owner cannot fix. anon-grants test 16/16. `gate.sh --fast` GATE OK twice (1065 passed); the builder's failure did not reproduce.
Not run: `supabase db reset` (from-scratch apply) and a browser walk as agent and admin. Four lows, none blocking.

## Findings (ranked)
1. **Low**, docs/DB.md:109. The doc says the `storage` function default is "not owned here". That is wrong: `postgres|storage|f` grants anon=X, and it is postgres's own default. Any function postgres later creates in `storage` will be executable by anon. Fix: correct the wording, and either revoke this default or record why it stays.
2. **Low**, docs/DB.md:104-110. The rule only mentions authenticated and service_role. Other roles that relied on PUBLIC (`supabase_auth_admin`, `supabase_storage_admin`, `authenticator`) no longer get execute on new postgres functions. Example: a future auth hook in `public` fails until it gets `grant execute ... to supabase_auth_admin`. Fix: add one line to the doc.
3. **Low**, supabase/migrations/00076_revoke_anon_function_execute.sql:73. The relation guard skips relations not owned by postgres without saying so. The function guard NOTICEs those cases, so the two checks are inconsistent. A remote table owned by supabase_admin with an anon grant would pass unseen. Fix: RAISE NOTICE that count too.
4. **Low**, src/lib/anon-grants.rls.test.ts:225. The result of the profile `update` that makes the test user an agent is not checked. If it fails, the user has no workspace, and the `dashboard_stats` / `current_fx_rate` checks can still pass. Fix: assert `error` is null and that `current_workspace_id()` equals `wsId`.

## Missing tests
- Snapshot test: the set of public functions that authenticated and service_role can execute equals a checked-in list. Today only 4 helpers are asserted; `order_stock_target`, `stock_order_reasons` and `normalize_dz_phone` for authenticated are not.
- An agent realtime `postgres_changes` subscription on `orders` (used by `new-orders-pill.tsx`).
- A store checkout (service role) insert into `customers` that fires `customers_normalize_phone` → `normalize_dz_phone`, asserted after 00076.
- Brief step 3 (browser walk as agent and admin) is still not done. The grant and RPC sweep above covers the DB side, not the UI.
- A from-scratch `supabase db reset` apply of 00076 was not re-run during review.
