VERDICT: ESCALATE

## Summary
Brief review (qa-reviewer, risk high). The migration plan works: a dry run in a rolled-back transaction confirmed the constraint name `wilayas_code_check`, 69 fee rows per workspace, code 70 rejected (23514), and all 3 FKs (wilaya_fees, orders, customers) intact.
Escalated because two findings need the owner: the 59–69 code list (A1), which decides where parcels and fees go, and the default fees/shipping for new wilayas (D14 impact).
The brief also misses a centroid numbering bug that already exists for 49–58, and its backfill test, as planned, fails in the live suite or checks nothing.
Local build can start once the brief is amended. Merge waits for the owner's answers.

## Findings (ranked)

1. **HIGH, owner decision: A1 codes route real parcels and money.** `src/app/app/settings/actions.ts:258-267` (syncZRFees), `src/lib/integrations/zrexpress-push.ts:64-69`, `fees-section.tsx:48` (bulk fee paste) all match a wilaya by number only. If ZR or the owner's fee CSV numbers 59–69 differently from the brief's list, which comes from memory (the order does not follow the parent wilayas, e.g. El Kantara from Biskra 7), fees and parcels go to the wrong wilaya with no error. **Fix:** make A1 a hard stop before merge: the owner confirms the list, or the ZR territory sync is run. Any later name correction migration uses `on conflict (code) do update set name`.

2. **MEDIUM: centroids for 49–58 are already misnumbered, so "1–58 unchanged" carries the bug forward.** `src/lib/geo/algeria-wilayas.ts:58-67` has 49 El M'ghair, 50 El Menia, 52 Bordj Badji Mokhtar, 54 Timimoun, 57 In Salah, 58 In Guezzam. `00007_seed.sql:15-17` has 49 Timimoun, 50 Bordj Badji Mokhtar, 53 In Salah, 54 In Guezzam, 57 El M'Ghair, 58 El Meniaa (verified). The map plots orders in the wrong place. **Fix:** renumber 49–58 to match the seed. Also fix the garbled names on lines 21, 28, 29, 56 ('Tbessa', 'Se9tif', 'Saefda', 'Ghardaefa'). Add the test in "Missing tests" below.

3. **MEDIUM: the planned backfill test fails or tests nothing.** The gate does not reset the DB. `src/lib/rls.test.ts:84` inserts "RLS Test WS2" after migrations have run, so it has 0 fee rows and "every workspace has 69" fails. After `db reset`, the migrations run before any workspace exists, so the backfill inserts nothing: the seed workspace's rows come from `seed_workspace`. **Fix:** apply 00028 with `npx supabase migration up` on the already seeded DB first, so the backfill meets real non-zero fees. Then `db reset` to prove a clean run. Scope the count assertion to the seed workspace. Add a re-run test: delete rows 59–69, run the backfill statement again, and assert 69 rows come back with the old fees unchanged.

4. **MEDIUM, owner decision: new wilayas default to 0/0 fees with shipping on.** `src/lib/webhook.ts:194-205`, `order-form.tsx:47`: an order from Barika gets `delivery_fee = 0`, so under D14 the COD amount leaves out delivery and the business absorbs it. The options are: keep 0 / copy the parent wilaya's fees (needs a parent map) / `stop_shipping=true` until an admin sets fees. The brief's "no new DECISIONS row" is wrong here: add a row with the owner's choice.

5. **LOW: loose webhook name match picks the parent.** `src/lib/webhook.ts:113-116` takes the first loose hit from unsorted rows, so "Ksar El Boukhari, Médéa" maps to 26, not 68. **Fix:** after the exact match, prefer the longest matching name. Add a test.

6. **LOW: existing orders filed under the parent may fail ZR push** once ZR moves their commune to a new wilaya (`zrexpress-push.ts:96-110`). This raises an error, not a crash. Note it in the brief's assumptions and leave the data unchanged.

7. **LOW: noise and hardening.** The backfill writes about 11 × workspaces `audit_log` rows with no actor (80 in the dry run). This matches what `seed_workspace` already does, so it is fine; note it in PROGRESS. Stale "58" comments: `comboboxes.tsx:8`, `webhook.ts:102`, `multi-select-search.tsx:12`, `docs/SPEC.md:144`. Use `drop constraint if exists`. Optional hardening: anon and authenticated hold INSERT/UPDATE/DELETE/TRUNCATE grants on `wilayas` with no write policy, so it is not exploitable today; `revoke` them.

The form actions (`orders/actions.ts:345`, `contacts/actions.ts:63`) have no upper bound on the code, and the DB check enforces it. Acceptable.

## Missing tests
- Live test: every `wilayas` row has a centroid with the same normalised name (catches finding 2).
- Agent UPDATE/DELETE on `wilayas` affects 0 rows. Assert the row is unchanged, not that an error comes back (RLS does not raise on update or delete).
- Insert with code 70 is rejected by the check constraint (23514), separately from the FK path (23503).
- Re-running the backfill is idempotent and keeps non-zero fees.
- `matchWilayaCode`: a new name (e.g. "Barika") and "town, parent" input.
