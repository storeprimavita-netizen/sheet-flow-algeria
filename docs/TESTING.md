# Testing — permanent local account & sample data

Local only. This account/data lives in the local Supabase docker stack
(named volumes persist across `docker compose stop`/`start`; they only
disappear if the volumes are explicitly removed, e.g. `supabase db reset` or
`docker volume rm`). Never point this at a remote/production project.

## Start the stack

```
supabase start          # or: docker compose -f supabase/docker-compose.yml up -d
npm run dev
```

App: http://localhost:3000 (redirects to `/login`).

## Accounts (password for all: `SeedDev!2026`)

| Email                    | Role               | What you see |
|--------------------------|---------------------|---------------|
| `admin@seed.mnw`         | Admin               | Everything — Dashboard, Finance, all money fields, Settings. **Use this one for UI/feature review.** |
| `confirmation@seed.mnw`  | Confirmation agent  | Orders → Confirmation queue only, no money. |
| `delivery@seed.mnw`      | Delivery agent      | Orders → Delivery queue only, no money. |

Workspace: **MNW Seed**.

A second workspace/account (`ws2-admin@seed.mnw`, same password) exists
purely to exercise multi-tenant RLS isolation (one product, "WS2-only
product") — ignore it unless you're specifically testing that a workspace
can't see another workspace's rows.

## Sample data currently in the workspace

(counts as of 2026-07-28 — re-seeding is idempotent and won't duplicate rows)

- 5 products (Robe Zahra, Ensemble Lina, Abaya Noor, Jupe Amel, Veste Sarah),
  each with sourcing cost/currency/fx-rate set so pricing/break-even math has
  real numbers to check.
- 60 orders spread across the 12 top wilayas (16-Alger, 31-Oran, 25-Constantine,
  19-Sétif, 9-Blida, 6-Béjaïa, 23-Annaba, 13-Tlemcen, 27-Mostaganem,
  35-Boumerdès, 42-Tipaza, 15-Tizi Ouzou), mixed confirmation/delivery statuses
  and sources, so funnels/rates/the wilaya table all have real drop-off to
  look at.
- 3 contacts, 10 expenses, 48 ad-spend rows (mixed test/scaling kind, mixed
  EUR/USD/DZD), 2 meetings (one planned ~3 days out), 2 rules docs.
- Exchange rates: EUR 260, USD 240 (fixed, not live — deterministic seed).
- `stop_shipping_rule` is overridden to `{min_orders: 3, min_delivery_rate: 40}`
  for this workspace only (the real default every other workspace gets from
  `seed_workspace()` is `min_orders: 10`) — at 10 the dashboard's wilaya map
  never colors anything against this seed's ~5 orders/wilaya. Don't take this
  `3` as the "right" production default; it's a demo-data accommodation.

## Re-seeding / resetting

The seed script is deterministic and idempotent — safe to re-run against the
same local DB; it looks up existing users/workspace/rows before creating
anything, so re-running does not duplicate data:

```
node --import ./scripts/seed-register.mjs --env-file=.env.local scripts/seed-dev.ts
```

It refuses to run unless `NEXT_PUBLIC_SUPABASE_URL` looks like localhost
(pass `--force` only if you really know what you're doing — never against a
linked/remote project).

For a **clean slate** (wipe and reseed from nothing):

```
supabase db reset        # wipes the local DB back to migrations, no seed data
node --env-file=.env.local scripts/seed-dev.ts
```

## What to check after every task

Log in as `admin@seed.mnw` and click through the section(s) touched:
- Both themes (dark is default; toggle in the sidebar/avatar menu).
- Both locales (English / Arabic — RTL).
- The specific numbers above (60 orders, 6 products, etc.) should still be
  exactly there — if a section's page 500s or shows 0 rows, something in that
  session's change broke a query, not the data.
