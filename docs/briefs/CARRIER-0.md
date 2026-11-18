# CARRIER-0 — wilaya reconciliation (58 → 69)
risk: high · surface: none · lane: orders

Goal: `wilayas` covers every wilaya the carriers serve (69, codes 1–69) and every workspace has a `wilaya_fees` row for each, without losing existing fees or orders.

## Definition of done
- `select count(*) from wilayas` = 69; codes 59–69 present, codes 1–58 unchanged (orders/fees FKs intact).
- Every existing workspace has 69 `wilaya_fees` rows (new rows 0/0, `stop_shipping=false`); old values untouched.
- `seed_workspace()` seeds 69 rows for new workspaces (reads from `wilayas`, no hard-coded count).
- Authenticated agent/admin can still read `wilayas`; nobody can write it (RLS test).
- Map, dashboard, ZR fee sync and webhook name match work with codes 59–69 (no crash, no skip).
- gate.sh green with live RLS suite.

## Findings (real code)
- `00002_settings.sql:9`: `wilayas.code smallint check (code between 1 and 58)` — the real blocker. Constraint is unnamed (auto name `wilayas_code_check`); drop by name, add `between 1 and 69`.
- Seed is a static insert in `00007_seed.sql` (58 rows, legacy 2019 split; 49–58 = Timimoun…El Meniaa). `seed_workspace` (latest def in 00014) already derives from `wilayas`, so it needs no change. Do not edit old migrations.
- `wilaya_fees` rows exist per workspace only for the old 58: a backfill insert is required.
- `src/lib/geo/algeria-wilayas.ts` has 58 centroids; `algeria-map.tsx:63` iterates centroids, so 59–69 would be missing on the map. `algeria-map.test.ts:6` asserts exactly 58 codes.
- `settings/actions.ts` `syncZRFees` filters ZR rates by `known` codes from `wilayas`: codes 59–69 are silently skipped today; fixed by the migration. `syncZRTerritories` stores ZR's own codes in `zr_territories.code`.
- `webhook.ts:109` matches names from the table: new names just work, but check accent/spelling normalisation.
- `docs/DB.md:44` says "58-row": update. Store copy "69" lives in STORE spec; never hard-code a count in code.

## Files and change
1. `supabase/migrations/00028_wilayas_69.sql` (next number after 00027):
   - `alter table wilayas drop constraint wilayas_code_check, add constraint wilayas_code_check check (code between 1 and 69)`.
   - `insert into wilayas ... on conflict (code) do nothing` for 59–69 (see assumption A1).
   - `insert into wilaya_fees (workspace_id, wilaya_code) select w.id, c.code from workspaces w cross join wilayas c on conflict do nothing`.
   - No new table: checklist N/A (reference table, RLS select-only already). Keep audit trigger on fees as is.
2. `src/lib/geo/algeria-wilayas.ts`: add centroids 59–69 (chef-lieu lat/lon) and fix header comment (69).
3. `src/components/dashboard/algeria-map.test.ts`: assert codes 1..69 (derive from the table of expected codes, not a magic 58 elsewhere).
4. `src/lib/rls.test.ts`: add cases below. `docs/DB.md`: row 44 -> "static national reference (69 after CARRIER-0)".
5. `scripts/check-wilayas.ts` (optional, small): compares `wilayas` with `zr_territories` level=wilaya (code+name) and prints diffs; run when ZR creds exist.

## Steps (commit each with scripts/step.sh)
1. Migration 00028 + `supabase db reset` locally; regen types only if the diff shows any (none expected).
2. RLS tests.
3. Centroids + map test.
4. DB.md + optional check script.
5. gate.sh.

## Acceptance tests (rls.test.ts / vitest)
- `wilayas: 69 rows, codes 1..69 contiguous`
- `wilayas: agent and admin can select; insert/update/delete denied`
- `wilaya_fees: every workspace has 69 rows after migration; pre-existing non-zero fees preserved`
- `orders: can insert with wilaya_code 69; 70 rejected`
- `algeria-map: 69 centroids, unique, inside bounds`

## Assumptions / edge cases
- A1 (needs check, not a new decision): codes and names 59–69 follow the 2025 reform order: 59 Aflou, 60 Barika, 61 Ksar Chellala, 62 Messaad, 63 Aïn Oussara, 64 Bou Saâda, 65 El Abiodh Sidi Cheikh, 66 El Kantara, 67 Bir El Ater, 68 Ksar El Boukhari, 69 El Aricha. This is from memory; ZR is the source (spec). Before merge, run the territory sync (needs ZR credentials: stop for the owner) or the owner confirms the list. If ZR codes differ, use ZR's.
- Existing orders keep their wilaya_code (parents of new wilayas are not re-assigned; no data rewrite).
- Existing customers/orders typed with the old parent wilaya stay valid.
- Local only; remote `db push` is owner-only.
- No new DECISIONS row needed.
