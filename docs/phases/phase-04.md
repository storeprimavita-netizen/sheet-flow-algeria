# Phase 4 — Pricing engine: scenarios + Real column + tests

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §6, docs/DB.md
(product_scenarios, product_stats). `src/lib/pricing.ts` is the source of
truth for the math — DO NOT change existing formulas.

## Goal

BENZ pricing tab on the product page + general planner, with the read-only
**Real** column and unit tests pinning the sheet's values.

## Steps

1. Port `<ScenarioEngine>` (`src/app/app/pricing/scenario-engine.tsx`) to v2:
   - persistence → `product_scenarios` (same partial-unique select-then-
     insert/update pattern as v1 — do not `upsert(onConflict)`).
   - seed defaults from Settings where available: `euro_price` from
     `current_fx_rate(ws,'EUR')`, fixed-fee inputs from `fixed_fees`
     (sum monthly DZD → the engine's `flexy_month`/`salary_month`/
     `location_day` mapping documented in code), `delivery_fee_da` from
     `settings.return_fee`.
2. **Real column** (admin, read-only): build `realInputsForProduct()` in
   `src/lib/pricing-real.ts` from actuals:
   - confirmation_pct / delivery_pct ← `product_stats` rates
   - lead/ad cost ← `ad_spend_daily` totals ÷ orders received (per-lead) with
     current EUR rate; spend_eur_day ← avg daily spend (last 30 days)
   - product_price ← `product_costs.sourcing_cost_dzd`
   - fixed fees ← active `fixed_fees`
   Show "—" whenever an input has no data (guarded divisions already return 0).
3. Wire tab into `/app/products/[id]`; keep `/app/products/planner`
   (product_id = null rows).
4. **Unit tests** (add `vitest` as devDependency + `npm test` script —
   first test infra in the repo):
   - BEST sheet values ⇒ `net_profit_per_order ≈ 1025.94` (±0.01),
     `net_profit_per_month ≈ 130037.5` (±0.5).
   - MEDIUM ⇒ ≈ −445.2 / −233750.
   - All-zero inputs ⇒ all zeros, no NaN/Infinity anywhere in the result.
   - `normalize_dz_phone`-style edge cases for `normalizeInputs` (strings,
     missing keys).

## Acceptance criteria

- Three editable scenario columns autosave (debounced) per product; Real
  column matches manual calculation for a seeded product; planner works.
- `npm test` green with the pinned-value tests; `npm run build` green.
- Agents cannot read `product_scenarios` (RLS) and never see the tab (guard).
