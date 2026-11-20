VERDICT: FIX

## Summary
Diff `git diff v3...v3-SEC-1-G`, reviewed by qa-reviewer (owasp-security, local stack, 00071 applied) and ui-reviewer (committed screenshots plus code).
What holds: privileges (invoker, volatility, search_path, execute only for postgres/service_role), real 42501 asserts, no plaintext leak, backfill finds 0 rows to change on 13,725 local rows, SQL/TS parity on 54 fuzzed unicode keys.
What blocks: the gate fails (the backfill test times out), idempotence still breaks at the depth cap for one shape, the filtered empty state shows the wrong copy, and Arabic is clipped at 390 px.

## Findings (ranked)

### M1 (medium): gate fails 3 out of 3 runs
- **Where:** `src/lib/audit-redact.rls.test.ts:155`, the "00071 backfill UPDATE … (xmin)" test.
- **Failure:** `execFileSync docker exec psql` runs the full-table UPDATE and blocks. In the full suite it takes 6.1–7.2 s, so vitest reports "Test timed out in 5000ms". It passes when run alone.
- **Fix:** give the test an explicit timeout, e.g. `test(name, fn, 120_000)`. Keep the exact migration UPDATE text.

### M2 (medium): idempotence breaks at the depth cap (the brief's Goal)
- **Where:** `supabase/migrations/00071_audit_redact_idempotent.sql:660-671` and `src/lib/audit-redact.ts:41-47`.
- **Failure:** take `nest(64, {key:"api_key", value:""})`.
  - Pass 1 masks `key` at depth 65 and keeps `""`.
  - Pass 2 no longer sees a secret key/value pair, so `""` becomes `[redacted:e3b0c442]`.
  - So `f(f(x)) != f(x)` and `TS(SQL(x)) != SQL(x)`, in both twins.
- **Fix:** keep `""` at any depth, the same way JSON null is kept, in SQL and TS. Add the case to `PARITY_CASES`.

### M3 (medium): filtered empty state is wrong and its action is repeated
- **Where:** `src/app/(app)/app/settings/audit/audit-table.tsx:~71-74`, seen in `en-dark-390-empty.png`.
- **Failure:** with filters active and no match, the title says "No audit entries yet.", and "Clear all" appears three times.
- **Fix:** when filtered, show "No entries match these filters" with a single clear-filters action (EN and AR).

### M4 (medium): Arabic is clipped at 390 px
- **Where:** `audit-table.tsx:~34` and the table container, seen in `ar-light-390.png`.
- **Failure:** the table scrolls sideways. The Action header is cut ("الإج…") and UPDATE loses its "TE". The Date column takes about 45% of the width.
- **Fix:** below `sm`, hide the Action and Agent columns and show them inline under the table name, or narrow the Date column.

### L1 (low): idempotence test ignores RPC `error`
- **Where:** `audit-redact.rls.test.ts:119-125`.
- **Failure:** a failed RPC returns `null`, and null == null makes every check pass.
- **Fix:** add `expect(error).toBeNull()` on both calls.

### L2 (low): the 42501 test uses an admin session
- **Where:** `audit-redact.rls.test.ts:128`.
- **Failure:** the brief asks for an agent session. Both roles map to `authenticated`, so the result is the same, but the test does not match the brief.
- **Fix:** add a session for an agent-role user.

### L3 (low): array index and object key give the same id
- **Where:** `diff.ts:103-113`.
- **Failure:** `{items:{"0":"a"}}` and `{items:["a"]}` both give id `["items","0"]`, so a change from object to array shows nothing.
- **Fix:** tag array segments in the id, e.g. `{i:0}`.

### L4 (low): bidi isolation removed from change lines
- **Where:** `audit-table.tsx:272`.
- **Failure:** `reviews` holds customer text. A value with U+202E can visually reorder the arrow and the next value, so the admin misreads the change.
- **Fix:** wrap the key and each non-pill value in `<bdi>`.

### L5 (low): ambiguous display of `a.b`
- **Where:** `audit-table.tsx:~43`.
- **Failure:** a flat key `a.b` and a nested path `a` → `b` look the same on screen. Only the React key tells them apart.
- **Fix:** show nested paths with " › ", or quote flat keys that contain a dot.

### L6 (low): D49 amendment not rendered
- **Where:** `docs/DECISIONS.md:74`.
- **Failure:** the amendment is a 4th cell on a 3-column row, so rendered markdown drops it.
- **Fix:** move the text into the decision cell.

### L7 (low): screenshots and Arabic pill order
- **Failure:** there are no loading or error-state screenshots, so 10 of the 12 expected shots exist.
- The Arabic "مخفي" pill sits inside an LTR run, so the word order reads oddly. Check it with an Arabic reader.

### Noted, not counted
- **Backfill on remote:** 00071 rewrites `audit_log` and makes `/sort_key`, `@cache_key` and `$color_token` visible in history. The brief already covers this as owner-only remote push plus the "0 rows change" re-check (O-2). It must stay owner-gated.
- **Spoofable pill:** a user-typed `[redacted:xxxxxxxx]` string renders as a pill. The brief accepts this (L4 decision) and nothing leaks.

## Missing tests
- `nest(64,{key:"api_key",value:""})` in `PARITY_CASES`.
- A unicode-separator fuzz list kept as a regression test.
- `error` null checks in the idempotence test.
- An agent-role session in the 42501 test.
- Diff tests:
  - object to array at the same path
  - a removed nested key that leaves an empty-object leaf
  - a spoofed mask string in a non-secret field
- Render tests:
  - `loading.tsx`
  - `error.tsx`, and `page.tsx` throwing when the query returns an error
  - the filtered empty state copy
