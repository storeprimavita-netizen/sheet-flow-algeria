VERDICT: FIX

## Summary
The design holds up. The masked-string passthrough cannot smuggle plaintext: only the exact 19-char token passes, and values past the cap are still hashed whole. The backfill is safe, since `audit_log` has no triggers and only an admin SELECT policy.
Five medium gaps must go into the brief before build: TS/SQL parity breaks on emoji separators, the backfill test has no way to run, the "cannot execute" tests can pass for the wrong reason, React keys still collide, and the "one `<ul>` per row" test cannot pass as written.
Reviewers: qa-reviewer (owasp-security) and ui-reviewer, which read the code and did not run the app.

## Findings (ranked)

### M1 (medium): emoji in key names break TS==SQL parity (src/lib/audit-redact.ts:11, brief item 2)
The planned `/[^a-zA-Z0-9]/g` has no `u` flag, so TS turns one astral character into two `_`. Postgres turns it into one. Confirmed on local DB: `"idempotency😀key"` is `idempotency__key` in TS (masked) and `idempotency_key` in SQL (allow-listed, stored raw). The page would then show a badge on a value stored in plaintext, and the DB.md parity claim would be false.
Fix: use `/[^a-zA-Z0-9]/gu` and add the emoji case to `PARITY_CASES`.

### M2 (medium): the "real SQL UPDATE" backfill test cannot run (brief item 4)
There is no `pg` driver in package.json. A builder would have to add a dependency (owner approval needed) or create an RPC, which would be an endpoint that should not exist.
Fix: the brief should say to run the exact UPDATE text from 00071 with `docker exec … psql` inside `begin … rollback`. Seed one row where only `old_row` is raw. Assert that clean rows keep the same `xmin`, which proves they were not rewritten.

### M3 (medium): "cannot execute" tests can pass for the wrong reason (src/lib/audit-redact.rls.test.ts)
`expect(error).not.toBeNull()` also passes on a lookup failure: a misspelled argument returned `PGRST202`.
Fix: assert code `42501` for anon and for an agent session, on both `audit_redact(j, depth)` and `audit_is_secret_key(k)`.

### M4 (medium): React keys still collide (audit-table.tsx:38, diff.ts, brief items 5–6)
The leaf map gets a new key, but the `<li key={c.key}>` still uses the dotted display string. `{"a.b":1}` and `{a:{b:1}}` give duplicate React keys and two rows that look identical. This is exactly the L1 case.
Fix: add `id: JSON.stringify(segments)` to `DiffChange` and use it as the React key. Keep `key` for display only. The `updated_at`/`created_at` skip should compare segments, not the joined string. Keep root `[]` distinct from empty key `[""]`, and give the empty key a visible label.

### M5 (medium): the render test spec "one `<ul>` per row" cannot pass (audit-table.tsx:57,62)
`ChangeList` is rendered twice per row: once in `sm:hidden` and once in `hidden sm:block`. A static render therefore always has 2 `<ul>`, two copies of each pill with `tabIndex=0`, and two copies of each aria-label.
Fix: specify one `<ul>` per container (2 per row), tested with `renderToStaticMarkup` as the existing tests do. Also assert there is no `"; "` and that the pill renders in EN and AR.

### Low
- L1, brief item 1 wording: "Keep the secret-key empty/masked rule" is wrong for SQL. Today SQL recurses on `""`, which is the original bug. Say "add": the value is returned as is, before the depth check.
- L2, grants: re-state `revoke … from public, anon, authenticated` on BOTH replaced functions. Forbid `drop function`, because a recreated function gets the default grants. Keep them invoker (not security definer), keep the volatility, and keep `set search_path`.
- L3, the done-when line "masks the same or more" is false in one corner. `/sort_key`, `@cache_key` and `$color_token` are masked under 00037 but become visible (allow-listed) after widening. This is harmless. Reword the line, document it in DB.md, and add D49 amendment text for the wider separator class and the plurals.
- L4, badge regression (diff.ts:31): after the idempotence fix, values masked at the depth cap under non-secret keys show as plain `"[redacted:…]"` text, not as a pill. Decide whether `show()` should also detect a masked string, and document the choice.
- L5, a11y: `aria-label` replaces the pill's content, so screen readers lose the fingerprint. Use an i18n key with a parameter, e.g. `audit.redactedAria`: "Redacted value, code {fp}", in EN and AR. Note that `tabIndex=0` stays only so keyboard users can reach the `title`.
- L6, bidi (audit-table.tsx:23): the pill has `dir="ltr"` around the Arabic word "مخفي". Drop `dir` from the pill and keep the `<bdi dir="ltr">` around the fingerprint only. Put `break-all` on a `<span>` around the key only, not on the whole line, so JSON values and the arrow do not break mid-token.
- L7, L3 flatten: the brief calls it optional but lists a test for it. State in or out.
- L8, backfill cost: the scan took 22 s on 167k local rows, with `audit_redact` evaluated 2–4 times per row. Compute it once per row in a subquery. Rows written while the migration runs are missed, so re-run the "0 rows change" check after the owner pushes.
- L9, housekeeping: run the deletes with local psql only, never in a migration. Delete the config row first, then its audit rows, because the first delete writes one more audit row.
- L10, four states: the audit route has no `loading.tsx` or `error.tsx`, and the empty state has no action. Add them, or mark them out of scope in the brief.
- L11, contrast: check that the pill text (`text-muted-foreground` on `bg-secondary`) reaches 4.5:1 in both themes.

## Missing tests
- Emoji (astral-character) separator case in `PARITY_CASES` (M1).
- `TS(SQL(x)) == SQL(x)` over `PARITY_CASES`. The page applies the TS redactor to rows the SQL redactor wrote, so this is the real path.
- `/sort_key`, `@cache_key` and `$color_token` names (L3).
- An `xmin`-unchanged check for clean rows in the psql backfill test (M2).
- Error code `42501` assertions for anon and agent (M3).
- Colliding-path render test with no duplicate-key warning (M4).
- `diff` test for nested `updated_at`, and for root vs empty key.
- Pill aria-label includes the fingerprint, in EN and AR (L5).

## Screenshots
- Save under `docs/design/audit/SEC-1-G/{en,ar}-{dark,light}-{1440,390}.png`. Every shot must show a visible change list.
- Seed rows covering: a pill, an empty key, a masked array, a colliding path, a very long key with no spaces, and a short line such as `is_active: ∅ → true`.
- Add one shot with a focused pill and one of the empty state.
- Do not reuse the SEC-1-F images.
