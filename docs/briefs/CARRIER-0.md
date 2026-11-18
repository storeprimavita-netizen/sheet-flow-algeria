# CARRIER-0 — wilaya map numbering + webhook name match (58 stays)
risk: low · surface: ui · lane: orders

Supersedes the old 58 → 69 brief (D26: wilayas stay 58, no migration, no A1 list, no fee backfill).
Goal: the dashboard map plots every wilaya under the right code and name, and a webhook wilaya name resolves to the most specific wilaya.

## Definition of done
- `WILAYA_CENTROIDS` codes 1–58 carry the same name as `wilayas` (seed `00007_seed.sql`), after accent/case normalisation.
- Garbled names fixed: 12 Tébessa, 19 Sétif, 20 Saïda, 47 Ghardaïa (and the rest match the seed spelling).
- `matchWilayaCode("Ksar El Boukhari, Médéa")`-style input returns the longest matching wilaya name, not the first loose hit.
- No migration, no DB change, no new DECISIONS row (D26 covers it).
- Map screenshots show 49–58 in the right places; gate.sh green.

## Findings (real code)
- `src/lib/geo/algeria-wilayas.ts:58-67`: 49–58 numbered from an older list. Seed: 49 Timimoun, 50 Bordj Badji Mokhtar, 51 Ouled Djellal, 52 Béni Abbès, 53 In Salah, 54 In Guezzam, 55 Touggourt, 56 Djanet, 57 El M'Ghair, 58 El Meniaa. Current file: 49 El M'ghair, 50 El Menia, 52 Bordj Baji Mokhtar, 53 Béni Abbès, 54 Timimoun, 57 In Salah, 58 In Guezzam (51, 55, 56 already right).
- Fix by moving coordinates, not inventing new ones: 49 = old 54 coords, 50 = old 52, 52 = old 53, 53 = old 57, 54 = old 58, 57 = old 49, 58 = old 50.
- Garbled names on lines for 12, 19, 20, 47 (`Tbessa`, `Se9tif`, `Saefda`, `Ghardaefa`). Other names drop accents (Medea, Ain Defla, Bechar); fine only if the test normalises, otherwise align them to the seed.
- Only consumer of centroids: `src/components/dashboard/algeria-map.tsx:63-65` (iterates codes; no change needed).
- `src/lib/webhook.ts:102-117` `matchWilayaCode`: exact match first, then `rows.find` takes the first loose hit from unsorted rows. Comment says "58-row": reword to "national reference". Stale "58" comment also in `src/components/fields/comboboxes.tsx:8` (leave, still true under D26).
- `src/lib/webhook.test.ts` has no wilaya match test; `matchWilayaCode` is not exported (test through the exported mapping/handler, or export it for test).

## Files and change
1. `src/lib/geo/algeria-wilayas.ts`: renumber 49–58 as above; fix garbled names; align all names to the seed spelling.
2. `src/lib/webhook.ts`: after the exact match, among loose hits pick the one with the longest normalised name (ties: lowest code). Export `matchWilayaCode` or a pure helper `pickWilaya(rows, name)` that takes rows (preferred: testable without a DB).
3. `src/components/dashboard/algeria-map.test.ts`: keep the 58-code test; add the name check below.
4. `src/lib/webhook.test.ts`: add match tests.

## Steps (each committed with scripts/step.sh)
1. Centroid renumber + name fixes + names test.
2. Webhook longest-match helper + tests.
3. Run the app, screenshot dashboard map (dark + light, EN + AR), note in PROGRESS.md. gate.sh.

## Acceptance tests (vitest)
- `WILAYA_CENTROIDS: names match the seed list for codes 1..58` (parse the `(n,'Name')` pairs from `supabase/migrations/00007_seed.sql`, normalise with the same function as webhook; no DB needed).
- `WILAYA_CENTROIDS: Timimoun sits near lat 29.3 lon 0.2 under code 49; El Meniaa near 30.6, 2.9 under code 58`.
- `pickWilaya: exact name wins`; `pickWilaya: "Médéa, Algérie" -> 26`; `pickWilaya: longest loose match wins` (e.g. "Bordj Bou Arreridj" never resolves to 16 or 34 wrongly; "Ain Defla" vs "Ain Temouchent" distinct); `pickWilaya: unknown -> null`; accent and case insensitive.

## Screens to screenshot (browser MCP)
- Dashboard with the wilaya map: dark and light, EN and AR. Check southern cells (49–58: Timimoun, In Salah, In Guezzam, Béni Abbès, Bordj Badji Mokhtar) hold the right orders by hovering/tooltips if present.

## Edge cases and assumptions
- Confirmed: `wilayas` seed has 58 rows, codes 1–58; unchanged. Orders/fees untouched.
- Voronoi cells shift for the southern wilayas only; no layout change otherwise.
- Normalisation: reuse `normalizeText` from `webhook.ts` (export it if needed) rather than a second implementation.
- Short input like "Alger" must not loosely match inside another name incorrectly; keep the existing `includes` both ways, just choose the longest name.
- Nothing needs an owner answer.
