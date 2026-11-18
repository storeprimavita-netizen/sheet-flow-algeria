VERDICT: FIX

## Summary
Code is correct: centroids 1–58 match `00007_seed.sql` names (normalised), 49–58 coordinates moved not invented, and review-1's three `pickWilaya` findings are fixed (apostrophe folding, guarded reverse match, added tests). Vitest: 22 pass, 1 skip (live DB).
One medium finding is left: the brief's screenshot requirement (dark and light, EN and AR, southern cells checked) is not met. Only one theme and one locale were captured, so the map half of the definition of done is unproven.

## Findings (ranked)

1. **MEDIUM — screenshots, `docs/design/audit/CARRIER-0/`.** Only `map-dark-en.png` and `dash-dark-en.png` exist. The brief's definition of done ("Map screenshots show 49–58 in the right places") and the AGENTS.md screenshot rule both need dark and light, in EN and AR. The seed orders are all northern, so no southern cell has been shown to plot under the right code.
   Fix: capture `map-{dark,light}-{en,ar}.png`. Locally (no remote DB), give one order each to wilayas 49, 53 and 58. Confirm the Timimoun, In Salah and El Meniaa cells light up, and hover them if the map has tooltips.
2. **LOW — `PROGRESS.md:130-131`.** The note says "Screenshots: not taken", but one dark/EN screenshot is committed. It also says "6 pickWilaya cases", but the test file has 8. Fix: update both lines once the screenshots are in.
3. **LOW, pre-existing — `src/lib/webhook.ts:131-133`.** `matchWilayaCode` swallows the `wilayas` query error (`data ?? []`). A DB error becomes a null wilaya and no shipping fee, with no trace. Fix: log the error. This is not a regression.
4. **LOW, follow-up.** Arabic wilaya names ("الجزائر", "وهران") never match, because the seed holds Latin names only. Fix: an alias table in a later task. Not in this brief's scope.

## Missing tests (optional)
- Centroids 49–58 have distinct lat/lon pairs.
- A positive case for the partial-unique path: `pickWilaya(rows, "Oued")` → 39.
- A leading-article case such as "El Taref" vs "Taref".

## Gate
Not rerun by the reviewer. PROGRESS reports only the stale-DB `rls.test.ts` D9/D10 failure, which also fails on untouched `v3`.
