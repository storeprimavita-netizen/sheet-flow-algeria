# MNW COD ERP — Roadmap

Cash-on-delivery e-commerce ERP for brand MNW (Algeria). Next.js 16 + Supabase.

## Status

| Phase | Status | Branch |
|-------|--------|--------|
| 0 — DB schema | ✅ done | `mnw` |
| 1 — Auth + RBAC scaffold | ✅ done | `mnw` |
| 1½ — Typed client + design system | ✅ done | `mnw-finish-phase1-design` |
| 2 — i18n (AR/EN + RTL) | ✅ done | `mnw-phase2-i18n` |
| 3 — Core ERP CRUD + order workflow | ✅ done | `mnw-phase3-crud` |
| 4 — Integrations (HMAC webhooks + settings) | ✅ done | `mnw-phase4-webhooks` |
| 5 — BI dashboard + price calculator | ✅ done | `mnw-phase5-bi` |
| 6 — Team automation (Slack) | ✅ done | `mnw-phase6-team` |

## Phases

### Phase 0 — DB schema ✅
`supabase/migrations/00001_init.sql`. Tables: `user_roles, products, contacts, orders, order_events, expenses, team_roles` + `customer_profiles` view. Enums, RBAC triggers, RLS.

### Phase 1 — Auth + RBAC ✅
Next 16 (`proxy.ts`), `@supabase/ssr`, session refresh, login, auth-gated dashboard. Roles: admin / confirmation_agent / delivery_agent. First admin via one-shot `bootstrap_admin()`.

### Phase 1½ — Typed client + design ✅
Typed `<Database>` on Supabase clients. Design tokens, UI primitives (Button/Card/Input/Label/Badge), AppShell with sidebar, polished login + dashboard.

### Phase 2 — i18n ✅
`next-intl` (v4) without i18n routing — cookie-based locale. `src/messages/{en,ar}.json`, `src/i18n/request.ts` reads `locale` cookie, `NextIntlClientProvider` in root layout flips `<html dir>` to `rtl` for AR. Locale switcher (sidebar footer + login) toggles cookie + `router.refresh()`. Sidebar/borders use logical props (`start-0`/`border-e`/`ps-64`) + `rtl:` translate for mobile drawer. All nav/login/dashboard strings translated.

### Phase 3 — Core ERP CRUD ✅
- **Products** (admin-writes, all-read): list + create/edit; 7 cost columns + status lifecycle; cost-total rollup in list.
- **Contacts** (admin-writes, all-read): list + create/edit; 5 contact types.
- **Orders** (role-scoped via RLS): list + admin create + detail workflow. Confirmation agents see only unconfirmed and update `confirmation_status`; delivery agents see only confirmed and update `delivery_status` (column guard trigger blocks cross-stage writes); admins do both. `order_events` audit trail (logged before the status flip so the confirmation→confirmed handoff still records history). Agent comments.
- **Expenses** (all users): list + create/edit; link to product/order; 8 categories.
- Shared: `PageHeader`, `Empty`, `Field`, `ButtonLink`, `DeleteButton`, styled native `<select>` + `<textarea>`, DZD/date formatters, `requireAdmin()` UX gate, bilingual labels/statuses/actions. Dashboard cards + sidebar now link to live modules (Settings/BI still "soon").

### Phase 4 — Integrations ✅
- **`app_settings`** key/value table (migration `00002_app_settings.sql`) — admin-only RLS. Stores HMAC webhook secrets + Slack token. **Migration applied** to `apsulsbdrnlesggzzfak` (2026-07-25, via CLI). Types already hand-added to `database.types.ts` → build typechecks; regenerating (`npx supabase gen types`) is optional cleanup.
- **Webhook routes** `/api/webhooks/{lightfunnel,shopify}`: constant-time HMAC-SHA256 verification (hex for Lightfunnel, base64 for Shopify), then idempotent order upsert keyed on `(source, external_id)`. Re-deliveries never clobber agent workflow state (only logistics fields update). No user session → runs via a **service-role client** (`src/lib/supabase/admin.ts`); requires `SUPABASE_SERVICE_ROLE_KEY` in env. Customer contact find-or-create by phone.
- **Admin Settings page** (`/app/settings`, admin-only): shows the exact webhook URLs to copy (computed from `APP_URL`/request host) + a per-secret set/not-set badge, and a form to store secrets (blank = keep current; never sends existing secrets to the browser).
- Note: secrets live in an admin-only table; for production prefer Supabase Vault / env.

### Phase 5 — BI + pricing ✅
`/app/bi` (Analytics): revenue (delivered orders), confirmed/pending counts, COD delivery & return rates, avg product margin (selling − Σ costs). Top-customers reliability table from the `customer_profiles` view. Live **price calculator** (7 costs + margin % → suggested price + per-unit profit).

### Phase 6 — Team automation ✅
- **`team_directory`** view (migration `00003_team_directory.sql`) — postgres-owned, joins `auth.users + user_roles + team_roles`, restricted to admins (`is_admin()`). Solves "auth.users isn't exposed over Postgrest" so the Team page can show emails. **Migration applied** (2026-07-25); types already hand-added to `database.types.ts`.
- **`/app/team`** (admin): inline-edit every user's `team_roles` — duty, Slack user/channel, meeting-late minutes, active toggle — and add/remove members.
- **Slack alerts on order events**: the order status update is now a **server action** (`orders/actions.ts`, RLS-enforced via the user's session client — same security as before) that logs the audit event, flips the status, then fires a best-effort Slack `chat.postMessage` (token + channel from `app_settings`; silently skips if Slack isn't configured). The client `OrderWorkflow` just calls the action.

### Phase 7 — Pricing scenarios (BENZ model) ✅
Replicated **`BENZ Pricing (31).xlsx`** — a COD unit-economics + scaling model — cell-for-cell. Three scenarios (best/medium/worst) each compute: ad-funnel (€/day spend → confirmed → delivered orders via euro rate, €/lead, confirmation %, delivery %), per-delivered-order P&L (COGS + acquisition cost + courier + packaging + returns + fixed-cost share), and daily/monthly net profit. Formula parity verified against the sheet (BEST = 1025.9 DZD/order, 130,037.5/month; MEDIUM = −445.2/order, −233,750/month).
- **`pricing_scenarios`** table (migration `00004_pricing_scenarios.sql`) — `product_id` nullable (null = general planner), `slug` ∈ best/medium/worst, 14 numeric `inputs` in jsonb. RLS mirrors products (all read, admin write). Two partial unique indexes: general `(slug) WHERE product_id IS NULL`, product `(product_id, slug) WHERE product_id IS NOT NULL`. **Migration applied** (2026-07-25); types hand-added to `database.types.ts`.
- **`src/lib/pricing.ts`** — the only source of truth for the math: `DEFAULT_INPUTS` (BEST), `normalizeInputs`, `seedForProduct`, `computeScenario()` (all divisions guarded → empty WORST yields 0, not #DIV/0!).
- **`<ScenarioEngine>`** (`pricing/scenario-engine.tsx`) — live recompute + debounced (700 ms) autosave. Because the unique indexes are partial, it resolves insert-vs-update per slug (select then update/insert) instead of `upsert(onConflict)`.
- **Two surfaces**: a general planner at **`/app/pricing`** (admin, nav entry) + the same engine embedded on **`/app/products/[id]`** seeded from the product's COGS + selling price. Both persist to the table.

### Phase 8 — Operational dashboard ✅
Replaced the static module-link dashboard with a live, icon-led KPI overview:
- **4 KPI cards** (Confirmed / Delivered / Returned / Revenue) — month value large, today's value as a sub-line; revenue accent-coloured.
- **Queue + totals** row — pending confirmation, awaiting delivery, product & customer counts (each links to its module).
- **Recent orders** table (6) with confirmation/delivery status badges, linked.
- **Quick links** — icon tiles to Orders / Products / BI / Expenses (+ Pricing for admins).
- **`dashboard_kpis()`** RPC (migration `00005_dashboard_kpis.sql`, applied) — single round-trip, `security invoker` so every metric respects the caller's RLS (admin = global, agent = scoped). Time-based metrics read from `order_events` transitions; queue counts from `orders`. Typed return added to `database.types.ts`.
- Fix: added the missing `role.{admin,confirmation_agent,delivery_agent}` i18n keys (caused a console error on every page via the app shell badge).

## Git workflow

- **`mnw`** is the integration branch (our main line).
- Each phase: create branch `mnw-<phase>`, commit, push, merge into `mnw` (`--no-ff`).
- Never commit `.env.local` or `graphify-out/` (gitignored).
