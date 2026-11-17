---
name: mnw-codebase-hygiene
description: Use when adding a feature, refactoring, or organizing files in the MNW COD platform — where code goes (feature folders, data layer, actions), dead-code removal, de-duplication, domain boundaries, and behavior-preserving change discipline.
---

# MNW codebase hygiene

## Before changing
- Baseline first: `scripts/gate.sh --fast`. Note route sizes if touching frontend.
- Find the existing helper before writing a new one (`graphify query` if installed, else Grep for the domain noun).

## Where code goes

```
src/app/app/<group>/<page>/        route = one screen
  page.tsx                         server component: auth, data, layout only
  actions.ts                       "use server" mutations for this route
  _components/                     UI used only by this route (private folder)
  _lib/                            helpers used only by this route
src/app/(store)/…                  public storefront routes (own layout, own theme)
src/app/api/…/route.ts             webhooks, cron, MCP, public order submit
src/components/ui|fields|…         UI shared by 2+ routes
src/lib/<domain>/                  domain logic shared by 2+ routes, no React
src/lib/<domain>/data.ts           data access layer for that domain
```

- **Promote on the second caller, not before.** Route-private first (`_components`, `_lib`); move to `components/` or `lib/<domain>` when a second route needs it.
- **Domains:** orders, customers, catalog (products, stock, research), pricing, store (pages, forms, offers, checkout), tracking, carriers, money, team, notifications, auth. A file belongs to one domain; a domain never imports another domain's `_lib`.
- **Data access layer.** Reads that more than one route needs live in `src/lib/<domain>/data.ts`, marked `import "server-only"`, and return DTOs — only the fields the UI needs, never a raw row with cost columns. The public store DAL is the one place that reads with the service role, and it returns published-only, cost-free DTOs.
- **Thin actions.** A server action does four things in order: parse input with zod → re-check the caller's role (never trust that the page was guarded) → one call into the domain layer or one Supabase mutation → revalidate + return a typed result. No business rules inline, nothing derived from client-sent prices or totals.
- **Route handlers and `proxy.ts` are public surface**: every new one is listed in the brief and reviewed as `surface: security`.
- Client components import types, not server modules. `admin.ts` (service role) is never reachable from a `"use client"` file.

## Database
- Migrations: one reviewable file per concern, numbered from the latest in `supabase/migrations/`; never edit an applied one. Table checklist is in AGENTS.md.
- RLS on every exposed table; policies say `to authenticated` and wrap helper calls as `(select public.current_workspace_id())` so they evaluate once per query. UPDATE needs `USING` and `WITH CHECK`. Views are `security_invoker`. Avoid new `SECURITY DEFINER` functions in `public`; when one is required, pin `search_path` and check the role inside. Never authorise on `user_metadata`.
- Types come from `database.types.ts` (generated). No duplicated row types by hand.

## Reduce code safely
- Reuse `src/components/ui`, `components/fields`, `lib/statuses.ts`, `lib/format.ts`. Pricing math exists in ONE place (`src/lib/pricing*.ts`), KPI rates in ONE place (SQL `kpi_lines`); never re-derive a rate in a page.
- Delete dead code only after checking: imports, dynamic imports, route files, server-action references (string names), SQL/RPC callers, webhook entry points, i18n keys used by `t()` with computed keys. One failed search proves nothing.
- Don't golf: no shortened names, no giant multi-purpose utils, no abstraction for one caller.
- Simplify long components by extracting domain logic into `src/lib/<domain>`, not by adding props.

## Protect behavior
- Refactor in small steps; gate after each; one step = one pushed commit (`scripts/step.sh`).
- Moving a route: add the permanent redirect in the same step, and keep the old i18n keys until nothing references them.
- Preserve RLS, the role wall (agents see no cost/profit/ads), RTL, accessibility.
- No circular imports, no hardcoded colors, every string in `messages/{en,ar}.json` (the gate checks both).
- Report removed / consolidated / moved and why in the PROGRESS.md block.
