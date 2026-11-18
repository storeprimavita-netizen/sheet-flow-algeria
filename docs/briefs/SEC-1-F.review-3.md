VERDICT: ESCALATE

## Summary
Review 3 of the diff (`git diff v3...v3-SEC-1-F`, HEAD 7266cbb, migrations up to 00038). qa-reviewer (owasp-security) and ui-reviewer both ran.
No high findings. One medium remains (M1): SQL and TS differ at the depth cap, and neither is idempotent there. No plaintext leaks; both sides mask more, not less.
The UI renders correctly in EN/AR, dark/light, 1280 and 390: one `<li>` per change, a localised pill, no page-level horizontal scroll.
ESCALATE because n = 3 with no PASS (loop rule). Also, the owner has not yet acknowledged the D49 run-together amendment from 00037.
Owner choice: (a) fix M1 in a new 00039 migration plus a TS change, then do one more review; or (b) accept M1 as unreachable (only admins write these tables) and correct the parity claim in DB.md.

## Findings (ranked)

### M1 (medium): depth-cap parity and idempotence
- **Where:** `supabase/migrations/00038_audit_redact_null_depth.sql:24-27,32` and `src/lib/audit-redact.ts:35,44`.
- **Failure:** take an object at depth 64 with a secret key whose value is `""` or already `[redacted:…]`.
  - SQL recurses to depth 65 and re-masks it, giving `{"secret":"[redacted:12ae32cb]"}`.
  - TS keeps the value as it is (`""`).
  - So DB.md's claim that "SQL and TS match exactly … nested objects" is false. The brief's done-criterion requires that claim to be true and tested.
- **Not idempotent:** at the cap, both sides re-hash an already-masked string, so `f(f(x)) != f(x)`.
  - Every future backfill rewrites those rows with a new fingerprint.
  - The page shows a fingerprint different from the stored one (stored `945603a8`, shown `1e573394`).
- **Fix:** in 00039 and in TS, return a string matching `^\[redacted:[0-9a-f]{8}\]$` unchanged. For a secret key whose value is `""` or already masked, return the value without recursing.
- **Tests to add:**
  - Cases `nest(64,{secret:""})`, `nest(64,{secret:"[redacted:aaaaaaaa]"})` and `nest(65,"[redacted:aaaaaaaa]")`.
  - An `f(f(x)) == f(x)` assertion over `PARITY_CASES`, in both SQL and TS.

### L1 (low): diff hides some real changes
- **Where:** `src/app/app/settings/audit/_lib/diff.ts:18,22,39`.
- **Failure:**
  - When dotted paths collide, one overwrites the other. `diffRows({"a.b":1,a:{b:1}},{"a.b":2,a:{b:1}})` returns `[]` and also produces duplicate React keys.
  - A change under an empty-string key is dropped by `out.delete("")`.
- **Fix:** key the map by `JSON.stringify(segments)`.

### L2 (low): separator class incomplete
- **Where:** `src/lib/audit-redact.ts:11` and the 00037 regex `[-. :]`.
- **Failure:**
  - `api/key`, `api_key\t`, `api+key`, `api,key` and `api<NBSP>key` stay visible in both SQL and TS.
  - The plurals `secretkeys` and `privatekeys` are missed.
- **Fix:** widen the separator class to `[^a-zA-Z0-9]` on both sides and add these cases.

### L3 (low): arrays are not flattened
- **Where:** `diff.ts`.
- **Failure:** an array that contains a secret shows raw JSON with the `[redacted:…]` token, not a pill. Cosmetic only; nothing leaks.

### L4 (low): pill accessibility differs from the brief
- **Where:** `src/app/app/settings/audit/audit-table.tsx:15-27`.
- **Failure:** `role="note"` and the `aria-label` are missing, so the explanation is only in `title`. Brief item 4 asks for both.
- **Fix:** restore `role="note"` and an `aria-label`.

### L5 (low): RTL layout at 390 px
- **Where:** `audit-table.tsx:20,36-40`.
- **Failure:**
  - Short lines such as `is_active: ∅ -> true` shrink-wrap and sit inset.
  - The pill wraps, leaving `->` on a line of its own.
- **Fix:** put `dir=ltr` on the `<li>`, or make the bdi `block w-full text-left`. Add `whitespace-nowrap` on the pill and `break-all` on the key.

### L6 (owner ack): D49 run-together amendment
00037 amends D49 with a run-together name list. It fails closed, but the owner has to acknowledge it.

### Housekeeping
- The local seed still holds a leftover `zrexpress` `integration_configs` row and its audit rows from earlier reviews. Delete them.
- The builder screenshots `ar-light-390.png` and `en-dark-390.png` show no change list, and `en-light-390.png` is missing.
- Fresh evidence is in `docs/design/audit/SEC-1-F/review2-*.png` and `review3-*.png`.

## Verified this round
- The live RLS suite `audit-redact.rls.test.ts` passed 8/8; unit and diff tests passed 58/58.
- Local `audit_log`: 0 rows still change under `audit_redact`, and no raw sentinel strings remain.
- Execute grants on all three functions: postgres and service_role only.
- The review-2 medium (jsonb null past the depth cap) is fixed in 00038:14.

## Missing tests
- Idempotence and the depth-64 secret cases (M1).
- The "agent session cannot execute" test signs in an **admin** (`audit-redact.rls.test.ts:33,115`).
  - Use a real agent session.
  - Also cover `audit_redact(jsonb,int)` and `audit_is_secret_key`, for anon and authenticated.
- The backfill test re-implements the UPDATE in JS. Run the real SQL `UPDATE … where … is distinct from` on seeded rows, including `old_row`.
- Allow-list edges: `"Key "` and `_key_`.
- `diffRows` with colliding paths, an empty key, and arrays of secrets.
- An audit-table render test: one `<ul>` per row, no `"; "`, pill present in EN and AR.
