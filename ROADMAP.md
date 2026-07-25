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
| 5 — BI dashboard + price calculator | ⏳ next | — |
| 6 — Team automation (Slack) | ☐ | — |

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
- **`app_settings`** key/value table (migration `00002_app_settings.sql`) — admin-only RLS. Stores HMAC webhook secrets + Slack token. **Apply the migration** (Dashboard → SQL Editor) and **regenerate types** (`npx supabase gen types ...`) so `app_settings` types come from the DB instead of the hand-added entry.
- **Webhook routes** `/api/webhooks/{lightfunnel,shopify}`: constant-time HMAC-SHA256 verification (hex for Lightfunnel, base64 for Shopify), then idempotent order upsert keyed on `(source, external_id)`. Re-deliveries never clobber agent workflow state (only logistics fields update). No user session → runs via a **service-role client** (`src/lib/supabase/admin.ts`); requires `SUPABASE_SERVICE_ROLE_KEY` in env. Customer contact find-or-create by phone.
- **Admin Settings page** (`/app/settings`, admin-only): shows the exact webhook URLs to copy (computed from `APP_URL`/request host) + a per-secret set/not-set badge, and a form to store secrets (blank = keep current; never sends existing secrets to the browser).
- Note: secrets live in an admin-only table; for production prefer Supabase Vault / env.

### Phase 5 — BI + pricing
Dashboard: revenue, margins (selling_price − Σ costs), COD delivery/return rates, customer reliability. Price calculator: costs + margin → suggested price.

### Phase 6 — Team automation
`team_roles` management, Slack alerts on order events, meeting-lateness tracking.

## Git workflow

- **`mnw`** is the integration branch (our main line).
- Each phase: create branch `mnw-<phase>`, commit, push, merge into `mnw` (`--no-ff`).
- Never commit `.env.local` or `graphify-out/` (gitignored).
