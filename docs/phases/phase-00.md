# Phase 0 — DB rebaseline + auth foundation

**Read first:** CLAUDE.md, PROGRESS.md, docs/DB.md (whole file).

## Goal

Replace the v1 single-store schema with the v2 workspace-scoped baseline and
get the app building/logging-in again on top of `profiles`.

## Steps

1. **Reset the linked Supabase project** (dev data is disposable —
   user-approved): run the `drop schema public cascade` block from docs/DB.md
   §"Applying the rebaseline", then `npx supabase db push`
   (applies `supabase/migrations/00001…00007`). Never touch
   `supabase/migrations_legacy/`.
2. Sign up the admin at `/login`, run
   `select public.bootstrap_workspace('sh.wailbmg@gmail.com','MNW');` in the
   SQL editor, verify: workspace row, admin profile active, 58 `wilaya_fees`
   rows, 5 `settings` rows.
3. Regenerate types:
   `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
4. Adapt code to the renamed auth tables:
   - `src/lib/rbac.ts` → read `profiles` (role + workspace_id + is_active);
     add `getProfile()` returning `{ role, workspaceId }`.
   - `src/lib/roles.ts` unchanged (same three roles).
   - Fix every query that referenced `user_roles`, `team_roles`,
     `app_settings`, `customer_profiles`, `dashboard_kpis` — pages that depend
     on not-yet-rebuilt tables (dashboard KPIs, team, cash, stock, settings,
     bi, reports, pricing, workbench) may be temporarily stubbed to an empty
     state ("rebuild in phase X" placeholder) BUT must compile and render.
   - Orders/products/contacts/expenses pages: point at v2 tables; every
     insert must set `workspace_id` (from `getProfile()`).
5. Update `src/lib/enums.ts`: `not_answer` → `no_answer`, add new enums
   (order_source, delivery_type, supplier_type, currency_code, ad_kind).
   Update `src/messages/{en,ar}.json` keys accordingly.

## Acceptance criteria

- `npm run build` passes; login works; admin lands on a rendering dashboard.
- An agent test-user (create via dashboard, set role in profiles) sees no
  data from financial tables (spot-check via the UI and a direct
  `supabase.from('expenses').select()` in the browser console → empty).
- No code references `user_roles`/`team_roles`/`app_settings` anymore.

## Handoff

Append to PROGRESS.md: what was stubbed and where, any type-gen quirks.
