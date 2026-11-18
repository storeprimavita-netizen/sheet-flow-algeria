VERDICT: PASS
## Summary
qa-reviewer (risk high). `git diff v3...v3-PRICE-1`: only `src/lib/pricing-v2.ts` + test; no pricing.ts import, no DB/UI.
pricing-v2 tests 46/46; `scripts/gate.sh` GATE OK. Formulas match PRICE.md / D50 / D51; all 30 benz cells + D51 markup pins match.
D52 items 1-6 implemented and tested; review-1..3 findings resolved. Probes (k=1, k>1, 1e308, Infinity, bad jsonb, `__proto__`) found no NaN/Infinity.
Only low findings remain; carry 1, 2 and the missing pins to the PRICE-2 follow-up.

## Findings (all low)
1. LOW `src/lib/pricing-v2.ts:198,200`: a typed negative best/worst ad cost passes `resolveAdCosts` (`{best:-1}` -> `best:-1`). The scenario still nulls totalCost, but PRICE-2 would display "-1 USD". Fix: require `fin(x) && x >= 0` for typed values (same as D52 item 6 for medium).
2. LOW `src/lib/pricing-v2.ts:182-183` via `computeAll` :379: a workspace `target:{value:2000}` without mode nulls every recommended price. This is consistent with D52, but the PRICE-2 workspace Settings form must always save mode + value together. Note it in the PRICE-2 brief.
3. LOW `src/lib/pricing-v2.ts:217-236`: `applyRounding(0.004,"charm99")` -> 99; `"none"` returns sub-cent values. Not reachable from the engine. Fix: return null when `round2(exact) <= 0`.
4. LOW (docs) `docs/DECISIONS.md` D52: it says share-100% line = 328.66; the correct value is 14790/45 = 328.67 (the test is right). Correct the D52 number.
5. LOW `src/lib/pricing-v2.ts:295`: `costPiece`/`sellable` go null when a rate is missing, though they don't depend on the rates. This only matters if PRICE-2 shows those lines on their own.

## Missing tests
- Margin is not pinned (benz medium at 4500 -> 11.7%).
- The platform % fee line is not pinned (benz medium ≈ 106.09).
- k > 1 from valid rates (e.g. platformPct 0.6 -> k 1.16). The current "k >= 1" test uses platformPct 1, which the range check rejects first.
- Negative typed best/worst ad cost (finding 1).
- Workspace target with value and no mode (finding 2).
- finalPrice 0 vs empty share one loop; the brief asked for separate tests (cosmetic).
