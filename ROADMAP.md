# MNW COD ERP — Roadmap

Cash-on-delivery e-commerce ERP for brand MNW (Algeria). Next.js 16 + Supabase.

## Status

| Phase | Status | Branch |
|-------|--------|--------|
| 0 — DB schema | ✅ done | `mnw` |
| 1 — Auth + RBAC scaffold | ✅ done | `mnw` |
| 1½ — Typed client + design system | ✅ done | `mnw-finish-phase1-design` |
| 2 — i18n (AR/EN + RTL) | ⏳ next | — |
| 3 — Core ERP CRUD + order workflow | ☐ | — |
| 4 — Integrations (HMAC webhooks + settings) | ☐ | — |
| 5 — BI dashboard + price calculator | ☐ | — |
| 6 — Team automation (Slack) | ☐ | — |

## Phases

### Phase 0 — DB schema ✅
`supabase/migrations/00001_init.sql`. Tables: `user_roles, products, contacts, orders, order_events, expenses, team_roles` + `customer_profiles` view. Enums, RBAC triggers, RLS.

### Phase 1 — Auth + RBAC ✅
Next 16 (`proxy.ts`), `@supabase/ssr`, session refresh, login, auth-gated dashboard. Roles: admin / confirmation_agent / delivery_agent. First admin via one-shot `bootstrap_admin()`.

### Phase 1½ — Typed client + design ✅
Typed `<Database>` on Supabase clients. Design tokens, UI primitives (Button/Card/Input/Label/Badge), AppShell with sidebar, polished login + dashboard.

### Phase 2 — i18n
`next-intl`, AR/EN message catalogs, locale switcher, RTL via `<html dir>`. All screens bilingual.

### Phase 3 — Core ERP CRUD
- Products: 7 cost columns + status lifecycle (to_be_tested → tested → confirmed/cancelled).
- Contacts: customers, suppliers, studios, atelier, emballage.
- Orders: confirmation queue (≠ confirmed) → confirmed → delivery handoff. `order_events` history + agent comments. Stage guards + RLS scoping per role.
- Expenses: open to all users.

### Phase 4 — Integrations
- `app_settings` (HMAC secrets, Slack token — admin-only).
- Admin Settings page: shows exact webhook URLs to copy.
- `/api/webhooks/{lightfunnel,shopify}` with HMAC validation → upsert orders.

### Phase 5 — BI + pricing
Dashboard: revenue, margins (selling_price − Σ costs), COD delivery/return rates, customer reliability. Price calculator: costs + margin → suggested price.

### Phase 6 — Team automation
`team_roles` management, Slack alerts on order events, meeting-lateness tracking.

## Git workflow

- **`mnw`** is the integration branch (our main line).
- Each phase: create branch `mnw-<phase>`, commit, push, merge into `mnw` (`--no-ff`).
- Never commit `.env.local` or `graphify-out/` (gitignored).
