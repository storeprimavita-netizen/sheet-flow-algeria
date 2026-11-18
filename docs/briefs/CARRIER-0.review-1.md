VERDICT: FIX

## Summary
Centroid renumbering 49–58 and the name fixes match `00007_seed.sql` (coordinates moved, not invented); the names test parses the seed. Vitest green (19 pass, 1 skip).
`pickWilaya` has two medium matching bugs: the reverse-substring branch resolves short or partial input to a wrong wilaya (wrong shipping fee), and apostrophes stuck to words block whole-word hits.
Screenshot requirement only partly met: dark/EN/desktop only (`docs/design/audit/CARRIER-0/map-dark-en.png`); light, AR and 390 px are missing. Seed orders are northern only, so the 49–58 cells cannot be checked visually.

## Findings (ranked)

1. **MEDIUM**, `src/lib/webhook.ts:117`, the `n.includes(target)` reverse branch. Any short input matches the longest name that contains it: "In" → 25 Constantine, "Bordj" → 50 Bordj Badji Mokhtar (not 34), "Ain" → 46. A wrong wilaya means a wrong delivery fee on a real order. Null is the safe result. **Fix:** drop the reverse branch, or allow it only when `target.length >= 4`, the target is whole words, and exactly one row matches (ambiguous → null).

2. **MEDIUM**, `src/lib/webhook.ts:112`. `words` keeps `'` inside tokens, so "Wilaya d'Alger" gives the token `d'alger` and ` alger ` never matches. The reverse branch also misses, so the result is null. The same happens with "l'…" prefixes. **Fix:** when building `words`, also split on `'`, `’` and `ʼ`, while keeping the seed names that contain an apostrophe (M'Sila, El M'Ghair) matching. For example, normalise the apostrophes in both the names and the input the same way before splitting.

3. **LOW**, `src/lib/webhook.ts:109` (`normalizeText` use). The curly apostrophe `’` is not folded to `'`, so "M’Sila" and "El M’Ghair" from mobile keyboards miss. Fold it in the normalisation step. Arabic wilaya names (an alias table) are out of scope: log them as a follow-up.

4. **LOW**, `src/lib/webhook.ts:102-106`. In a multi-wilaya string ("El Oued, Alger") the longest name wins and ties go to the lowest code. This is acceptable under the brief, but the doc comment should say so.

5. **LOW** (pre-existing), `src/lib/webhook.ts:130`. The `wilayas` query error is ignored (`data ?? []`), so a DB error silently returns null. Leave it as is or log the error. It is not a regression.

6. **LOW (process)**. The brief's step 3 asks for screenshots in dark + light and EN + AR. Only dark/EN exists. Add the light and AR captures and note them in PROGRESS.md.

## Missing tests
- "Wilaya d'Alger" → 16; "Wilaya de Béjaïa" → 6.
- Short or ambiguous input "In", "Bordj", "Ain" → null (after fix 1).
- "M’Sila" → 28; "El M’Ghair" → 57 (after fix 3).
- Loose southern regressions: "Béni Abbès, Algérie" → 52 (not 22), "In Salah" → 53, "Timimoun" → 49, "El Meniaa" → 58, "Algérie" alone → null.
- Loose "Bordj Bou Arreridj, Algérie" → 34. The current test only covers the exact match.
- Centroids: codes 49–58 have distinct lat/lon.
