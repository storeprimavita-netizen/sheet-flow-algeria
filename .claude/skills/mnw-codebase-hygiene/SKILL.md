---
name: mnw-codebase-hygiene
description: Use when refactoring, adding a feature, or organizing files in the MNW COD ERP — covers dead-code removal, de-duplication, feature/domain boundaries, and behavior-preserving change discipline.
---

# MNW codebase hygiene

## Before changing
- Baseline first: `npx tsc --noEmit`, `npm run build`, `LOCAL_SUPABASE_URL=http://127.0.0.1:54321 npm test`. Note route sizes if touching frontend.
- `graphify query` / `graphify path` to find existing helpers before writing new ones.

## Reduce code safely
- Reuse `src/components/ui`, `components/fields`, `lib/statuses.ts`, `lib/format.ts`, `lib/pricing.ts`. Pricing/KPI math exists in ONE place (SQL `kpi_lines` + `pricing.ts`); never re-derive a rate in a page.
- Delete dead code only after checking: imports, dynamic imports, route files, server-action references (string names), SQL/RPC callers, webhook entry points, i18n keys used by `t()` with computed keys. One failed search proves nothing.
- Don't golf: no shortened names, no giant multi-purpose utils, no abstraction for one caller.
- Simplify long components by extracting domain logic into `src/lib/<domain>`, not by adding props.

## Organize
- Next.js conventions: server components by default, `actions.ts` per route, zod at every boundary.
- Domain boundaries: orders, products, stock, finance, integrations, auth, dashboard. Cross-feature UI belongs in `components/`; domain logic in `lib/`.
- No circular imports, no duplicated types (use generated `database.types.ts`), no hardcoded colors, every string in `messages/{en,ar}.json`.
- Migrations: one reviewable file per concern, RLS + `set_updated_at` + audit trigger checklist from CLAUDE.md; never edit applied migrations.

## Protect behavior
- Refactor in small steps; run relevant tests after each; compare build output before/after.
- Preserve RLS, role wall (agents see no cost/profit/ads), RTL, accessibility.
- Report removed / consolidated / moved and why in the PROGRESS.md block.
