# Codebase Audit — 2026-07-26

Honest assessment of the existing app before the v2 refactor plan.

## Verdict up front

The premise "GLM app, good core, terrible organisation" **does not match this repo**.
What's here is a disciplined 13-phase build (see ROADMAP.md + git history) with
versioned migrations, RLS, typed Supabase clients, verified pricing math, and
i18n. The organisation is fine. What it actually lacks versus the target spec:

- **Not SaaS-ready** — no `workspaces`, no `workspace_id`, RLS is role-only.
- **Missing domain features** — wilayas/delivery-fee table, fixed fees, exchange
  rates, multi-currency expenses, ad-spend tracking, customer risk score,
  duplicate detection, meetings, rules docs, generic audit log, webhook raw
  event store, "Real" pricing scenario, per-wilaya/per-agent BI, stop-shipping.
- **Contradicts spec** — Slack integration exists (user decided against it);
  sidebar has ~12 sections vs the required 6; customers live inside `contacts`.

Decisions taken with the user (2026-07-26): **clean DB rebaseline** (dev data is
disposable), **fold** cash/stock/workbench/reports into the 6 sections,
**remove Slack**, **keep EN/AR** i18n.

## Keep as-is (proven, spec-compliant)

| Path | Why |
|---|---|
| `src/lib/pricing.ts` | Exact BENZ xlsx replica, division-guarded, parity-verified (best: 1025.9 DZD/order, 130,037/mo). Only addition needed: "Real" scenario compute + unit tests. |
| `src/lib/webhook.ts` | Constant-time HMAC (hex/base64), idempotent upsert on `(source, external_id)`, provider mapping abstraction. Needs re-pointing at the v2 schema + `webhook_events` raw store. |
| `src/lib/supabase/{client,server,admin,session}.ts` | Correct `@supabase/ssr` setup; service-role isolated to `admin.ts`. |
| `src/proxy.ts` | Next 16 session-refresh proxy (this Next version's replacement for middleware). |
| `src/i18n/*`, `src/messages/*` | Cookie-based next-intl v4 with RTL — keep; strings already centralized. |
| `src/components/ui/*`, `app-shell.tsx`, shared components | Design system + shell; only the nav map changes. |
| `src/lib/{format,csv,utils,enums,roles}.ts` | Small, clean helpers. `enums.ts` needs `not_answer`→`no_answer` + new enums. |
| Webhook route handlers `src/app/api/webhooks/*` | **Deviation from spec** (spec said Supabase Edge Functions) — keeping Next.js route handlers: already built, HMAC-verified, same Vercel deploy unit, no Deno toolchain. Rationale in docs/SPEC.md §Deviations. |

## Refactor / relocate

| Path | Change |
|---|---|
| `supabase/migrations_legacy/*` (old 00001–00008) | Superseded by the v2 baseline in `supabase/migrations/`. Live project must be reset (Phase 0). |
| `src/lib/rbac.ts` | Read `profiles` instead of `user_roles`; add `requireRole()` + workspace awareness. |
| `src/app/app/*` routes | Reorganize to the 6-section IA (see docs/SPEC.md §Navigation). Orders gets `all/confirmation/delivery` subviews; products get a tabbed detail page. |
| `src/app/app/stock/*` | Fold into Products (tab on product page + column in list). |
| `src/app/app/reports/*` | Fold into Dashboard (export toolbar). |
| `src/app/app/cash/*` | Fold into Orders as an admin-only "Cash" subview. |
| `src/app/app/workbench/*` | Its assignment/attempt features merge into the Orders confirmation & delivery queues; standalone page goes away. |
| `src/app/app/bi/*` + `dashboard/*` | Merge into one Dashboard (home) with the global filter bar. `bi/price-calculator.tsx` (margin calculator) is superseded by the scenario engine — delete. |
| `src/app/app/pricing/*` | Scenario engine survives, but its home is the product page tab; keep `/app/pricing` as the "general planner" under Products. |
| `src/app/app/{team,roles}/*` | Merge into Team & Rules section (users, rules, meetings, performance, audit log). |
| `src/lib/app-settings.ts` | Replace key/value `app_settings` usage with v2 `settings` + `integration_configs`. |
| `src/lib/supabase/database.types.ts` | Regenerate from the v2 schema (stop hand-editing types). |

## Delete

| Path | Why |
|---|---|
| `src/lib/slack.ts` + Slack fields/calls (`orders/actions.ts`, team page) | User decided against chat integration. |
| `src/app/app/bi/price-calculator.tsx` | Superseded by BENZ scenario engine. |
| `graphify-out/` | Stale index artifact from an unavailable tool (gitignored already). |
| `public/{next,globe,file,window,vercel}.svg` | create-next-app leftovers. |
| Legacy DB objects (`user_roles`, `team_roles`, `app_settings`, `cash_collections` v1, contacts-as-customers, `customer_profiles` view, `dashboard_kpis()` v1, `team_directory`) | Dropped by the Phase 0 reset; v2 equivalents exist in the new baseline. |

## Risks / notes

- The live Supabase project (`apsulsbdrnlesggzzfak`) has the v1 schema applied;
  Phase 0 wipes and re-applies. Anything in it worth keeping must be exported
  first (user confirmed it's test data).
- `database.types.ts` was partially hand-maintained — after Phase 0, types are
  always regenerated, never hand-edited.
- `BENZ Pricing (31).xlsx` sits untracked in the repo root; keep untracked
  (reference artifact, not code).
