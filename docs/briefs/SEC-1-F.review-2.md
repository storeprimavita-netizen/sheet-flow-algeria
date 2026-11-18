VERDICT: FIX

## Summary
Two reviewers (qa-reviewer with owasp-security, ui-reviewer), diff `git diff v3...v3-SEC-1-F`. No high findings. The live suite passed (65/65), the local audit_log is clean after the 00036/00037 backfills, and anon/authenticated cannot execute the functions.
One medium blocks the PASS: the SQL/TS parity claimed in DB.md is false for jsonb `null` at the depth cap. That claim is a done-criterion in the brief.
Review-1 fixes #1–#4, #10 are verified. #5 works on screen at 390 px, but the builder's screenshots are stale and `en-light-390.png` is still missing (#11).
The 00037 amendment to D49 is fail-closed. It still needs the owner to acknowledge it (low, not an escalation).

## Findings (ranked)

### M1 — medium — jsonb `null` breaks SQL/TS parity at the depth cap; DB.md claims parity for null
- `src/lib/audit-redact.ts:34` skips `null` before the depth check. `supabase/migrations/00036_audit_redact_acronyms.sql:33-36` only returns early on SQL NULL, so a jsonb `null` past depth 64 is masked.
- Probes (SQL vs TS): `audit_redact('null',65)` gives `"[redacted:74234e98]"` vs `null`. `{a:null}` at depth 64 gives `{"a":"[redacted:74234e98]"}` vs `{"a":null}`. `{secret:null}` at 64: SQL masks it, TS keeps it. Below the cap, SQL keeps a null secret visible, so SQL is also inconsistent with itself.
- `docs/DB.md:35` states parity including null.
- Fix: add migration 00038 that returns `j` when `jsonb_typeof(j) = 'null'` before the depth branch, so it matches TS. Add depth 64 and 65 cases to `audit-redact.cases.ts`: null, a secret key at the boundary, an array.

### L1 — low — stale 390 px screenshots (review-1 #5/#11 evidence)
- `docs/design/audit/SEC-1-F/ar-light-390.png` and `en-dark-390.png` (re-shot in f326251) show no change list under `integration_configs`. `en-light-390.png` is missing.
- The ui-reviewer ran the app and saw the list stacked correctly at 390 px with no page-level horizontal scroll. The code is fine; the evidence is not.
- The reviewer's shots are committed with this review as `review2-*.png` (EN light/dark 390, AR light/dark 390, AR/EN light 1280).
- Fix: re-shoot the builder set using a row that has changes, or reference the `review2-*` files in PROGRESS.

### L2 — low — dotted-path collision hides a real change
- `src/app/app/settings/audit/_lib/diff.ts:22`: `Map.set` overwrites, so `diffRows({"a.b":1,a:{b:1}},{"a.b":2,a:{b:1}})` returns `[]`. The same collision gives two `<li>` the same React key (`audit-table.tsx:38`).
- Fix: key the map by `JSON.stringify(segments)` and display the dotted form.

### L3 — low — arrays not flattened; values the DB already masked render as quoted text, not a pill
- `diffRows({a:[{password:"x"}]},…)` shows raw `[{"password":"[redacted:…]"}]` with no pill.
- For stored rows masked by the value-prefix rule or the depth cap, `show()` (`diff.ts:31`) prints a quoted `"[redacted:…]"`, because the raw value equals the redacted one after the trigger.
- Cosmetic only; no plaintext leaks.
- Fix: recurse into arrays by index path. Treat a DB value that already matches the badge pattern under a secret-named or depth-capped path as `redacted`.

### L4 — low — AR 390 px: short change lines inset/centred
- `audit-table.tsx:36-40`: `<bdi dir="ltr" class="inline-block">` shrink-wraps inside the RTL `<li>`, so `is_active: ∅ -> true` sits inset (`review2-ar-light-390.png`).
- Fix: put `dir="ltr"` on the `<li>`, or make the bdi `block w-full text-left`.

### L5 — low — pill wraps on phones
- `audit-table.tsx:20`: in EN at 390 px, "Redacted" and the hash split onto two lines and `->` falls on its own line (`review2-en-dark-390.png`).
- Fix: add `whitespace-nowrap` on the pill and `break-all` on the key.

### L6 — low — a11y differs from the brief
- `audit-table.tsx:15-24`: `role="note"` was dropped, and the explanation lives only in `title` (not reliably announced). There is also a redundant title plus visible text on a `tabIndex=0` span.
- Fix: restore `role="note"` with an `aria-label` carrying the explanation, and drop the duplicate `title`.

### L7 — low — review-1 #7 partly done; D49 amended by the builder
- Still unmasked in SQL and TS: `api/key` and `api_key\t` (the separator class at `audit-redact.ts:11`), plus the plurals `secretkeys` and `privatekeys`.
- D49 now carries a 00037 amendment (run-together list) that review-1 left to the owner. It is fail-closed, so not blocking.
- Fix: add `/` and whitespace to the separator class in both normalisers, and add the plurals. Owner to acknowledge the D49 amendment in the PROGRESS note.

## Missing tests
- Backfill: run the real `UPDATE … where … is distinct from` statement against seeded rows, covering `old_row` too. Today it is re-implemented in JS and compared with `JSON.stringify`.
- Execute-denied for `audit_redact(jsonb,int)` and `audit_is_secret_key`, by anon and authenticated. Grants were verified by hand only.
- The "agent session denied execute" test signs in an admin; use a real agent session.
- Depth parity at 64 and 65, including jsonb null (M1).
- Allow-list edges: `"Key "`, `_key_`.
- `diffRows`: arrays of objects containing secrets; colliding dotted paths.
- Audit-table render: one `<ul>` per row, no `"; "`, pill present in EN and AR.

## Note
The ui-reviewer left local test data in the seed workspace: one `zrexpress` integration_configs row plus 2 audit rows. Delete them for a clean seed.
