@AGENTS.md

# MNW COD ERP — project conventions

COD ecommerce ERP (Algeria), SaaS-ready single workspace. Next.js 16 +
Supabase (Postgres/Auth/RLS) + Vercel. Currency DZD (USD/EUR stored with rate).

## Session protocol (every execution chat)

1. Read `PROGRESS.md`, then your phase file `docs/phases/phase-XX.md`.
2. Read ONLY the docs sections your phase file lists. Don't re-read the whole
   spec; don't read `supabase/migrations_legacy/` (superseded v1).
3. Work on a branch `mnw-<phase>`; merge `--no-ff` into `mnw` when green.
4. End of phase: `npm run build` (and `npm test` once it exists) green, then
   APPEND a block to `PROGRESS.md` (format documented there). Never leave the
   build broken.
5. Tools (docs/TOOLING.md has the full rules): invoke the
   `ponytail:ponytail` skill before writing code and run
   `ponytail:ponytail-review` on the diff before merging; use
   `graphify query "<question>"` to orient in the codebase and run
   `graphify update .` after code changes (see §graphify below).

## Stack facts

- **Next.js 16 is NOT the Next.js you know** (see AGENTS.md): check
  `node_modules/next/dist/docs/` before using an API you're unsure of.
  Session refresh lives in `src/proxy.ts` (not middleware).
- Supabase clients: `server.ts` (RSC/actions, RLS-scoped), `client.ts`
  (browser), `admin.ts` (service role — **server-only**: webhooks, invites;
  never import into client components). Types in
  `src/lib/supabase/database.types.ts` are **generated, never hand-edited**:
  `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`.
- i18n: next-intl v4, cookie locale, EN/AR with RTL. Every user-visible
  string goes in `src/messages/{en,ar}.json`. Use logical CSS props
  (`ps-`, `border-e`, `start-0`) so RTL works.
- UI: Tailwind v4 + primitives in `src/components/ui/`. Reuse
  `PageHeader/Empty/Field/ButtonLink/DeleteButton` etc.

## Code style

- TypeScript strict, no `any`. zod-validate every form action + webhook payload.
- Server components by default; client components only for interactivity.
- Mutations = server actions colocated in `actions.ts` per route, using the
  session client (RLS-enforced). Service role only where documented.
- Money: numeric DZD; format with `src/lib/format.ts` (thousands separators).
  Foreign currency rows store `amount`, `currency`, `fx_rate`, generated
  `amount_dzd`.
- Pricing math lives ONLY in `src/lib/pricing.ts` — never fork the formulas.

## RLS rules of thumb (the wall is the DB, UI is cosmetic)

- Every business table: `workspace_id` + policy
  `workspace_id = public.current_workspace_id()` and role predicate.
- Financial tables (`product_costs`, `expenses`, `ad_spend_daily`,
  `fixed_fees`, `exchange_rates`, `cash_collections`, `product_scenarios`,
  `settings`, `contacts`, `audit_log`, `webhook_events`) are **admin-only**.
  If a feature needs agents to see money, the feature is wrong — re-read
  docs/SPEC.md §2.
- New table checklist: workspace_id FK · RLS enable + policies ·
  `set_updated_at` trigger · `audit_row()` trigger if config/financial ·
  add to docs/DB.md table · regen types.
- Status changes: update `orders`; triggers write history/stock — never
  insert into `order_status_history` from the app.

## Running

`npm run dev` · build gate `npm run build` · migrations `npx supabase db push`
· env in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`). Never commit `.env.local`; never
expose the service key to the client.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
