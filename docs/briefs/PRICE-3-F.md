# PRICE-3-F brief
risk: low · surface: ui · lane: catalog

Source: `docs/briefs/PRICE-3.review-4.md` (findings 1-5, missing tests) + reviews 1-3 lows. No migration, no new DECISIONS row.

## Goal
Real column edge cases (a rate of exactly 0) draw only what the engine says, with a footer that matches the cells.

## Definition of done
- Ad cost 0 with c = 0: Real profit, minConfirmation, minDelivery come from the engine (rate-1 run), never "Not possible"/red "below" for a 0 break-even.
- The "not possible" footer shows only if at least one drawn cell is "impossible".
- Both rates 0 (ad > 0): one extra footer line says why (EN + AR, key parity).
- Real column keeps a visible divider from the scenario columns (U4): `border-s` is on the Real th/td (pricing-results.tsx l.173, 221) and review-2 called it fixed; confirm in screenshots, fix only if not visible in both themes.
- Review-4 missing tests added; gate green.

## Files
- `src/lib/pricing-form.ts` (`realZeroRowMode`, l.~395): add `adCostUsd` (number|null) param; when it is 0, c drops out of the engine, so a c=0 row is "alt" (except ordersNeeded and the ad-total rows). Add pure helper `realCellState(mode, src, row)` returning `{state, srcKey}`, and `anyRealImpossible(input, rows, rateOneComplete)`; JSX becomes a lookup (review-4 #4). No formulas copied.
- `src/app/(app)/app/products/[id]/pricing/pricing-results.tsx`: use the helpers (l.137-145 footer, l.220-240 cell); footer = `anyImpossible` from drawn modes (Real from `anyRealImpossible`, scenarios as today); add both-zero line when `realZero && both rates 0`.
- `src/messages/en.json`, `ar.json`: `pricingV2.realBothZeroHint` ("No orders were confirmed or delivered yet, so Real break-even cannot be computed").
- Tests: `src/lib/pricing-form.test.ts`, `src/lib/pricing-real.test.ts`, `src/lib/pricing-v2.test.ts`.

## Steps (each commit + push)
1. Helpers + tests (ad = 0 cases, footer derivation, per-row drawn state for d=0, c=0, both 0).
2. Wire JSX to helpers; footer fix.
3. Both-zero line, EN/AR.
4. Remaining tests; screenshots.

## Acceptance tests
- `realZeroRowMode ad 0, c 0, d 0.6` -> minConfirmation "alt", real profit from engine (3 706 DA case).
- `c 0, d 0, ad 0` -> minDelivery "alt".
- `anyRealImpossible` false when c=0 and d null (all cells "missing").
- `realScenarioInput` with `confirmation.value = 0` maps confirm 0.
- NaN stock cost -> rateOne.totalCost null -> cell "missing".
- Engine: d=0 keeps finalPrice non-null; minDelivery equal at d=1 and d=0.0001 (same for c).
- `toRealKpiSlice` output has no `pnl`, `waterfall`, `net_profit` keys.
- Drawn value+state per Real row for d=0, c=0, both 0.

## Screens (both themes, EN + AR, 1280 and 390 px)
`/app/products/<id>/pricing`: c=0 ad=0; d=0; both 0 (footer line); c=0 with d null (no footer); normal data (divider visible). Use `db reset` after making cases.

## Edge cases / notes
- Review-4 L5 (Real column off-screen at 390 px) and lows 2-4 of reviews 1-3 (36 px targets, popover edge, brief l.7): do only the cheap ones; list the rest in PROGRESS.
- Assumes the engine ignores c when ad = 0 (review-4 verified numerically); the builder re-checks before coding.
