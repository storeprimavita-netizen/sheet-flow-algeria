# Phase 1 — App shell, six-section IA, role guards, Slack removal

**Read first:** CLAUDE.md, PROGRESS.md, docs/SPEC.md §1 (Navigation) + §2.

## Goal

Reorganize routes into the six-section sidebar, wire role-based guards, and
delete Slack. No new features — moves, deletions, guards only.

## Target route map

```
/app/dashboard                    (home — placeholder until Phase 7)
/app/orders            → /app/orders/all (default)
/app/orders/all|confirmation|delivery|cash
/app/orders/[id], /app/orders/new
/app/products, /app/products/[id] (tabbed), /app/products/new, /app/products/planner
/app/contacts          → customers | suppliers tabs
/app/team              → users | rules | meetings | performance | audit tabs
/app/settings          → sections per SPEC §9
```

## Steps

1. Sidebar (`src/components/app-shell.tsx`): exactly six entries, role-aware
   (agents see only Dashboard? NO — agents see ONLY Orders (their queue) and
   nothing else per SPEC §2; admins see all six). Update `src/messages/*`.
2. Move/merge routes: `bi`+`reports` → dashboard dir (placeholder page for
   now, keep the exporter component file for Phase 7), `cash` → orders/cash,
   `stock` UI → parked for Phase 3 (delete the route, keep `stock-manager.tsx`
   moved next to products), `workbench` → delete route (assignment card
   already lives in orders/[id]), `roles`+`team` → team.
3. Route guards: layout-level `requireRole()` per section — agents hitting
   admin routes are redirected to their queue. Keep RLS as the real wall.
4. Delete `src/lib/slack.ts`, the Slack call in `orders/actions.ts`, Slack
   fields in team UI, and `bi/price-calculator.tsx`. Remove create-next-app
   SVGs in `public/`.
5. Centralize new nav strings in `src/messages/{en,ar}.json`.

## Acceptance criteria

- Six sidebar sections for admin; confirmation agent sees only
  Orders→Confirmation (plus their own queue routes); delivery agent only
  Orders→Delivery.
- All old URLs removed or redirecting; `npm run build` green; no Slack
  references (`grep -ri slack src/` → empty).

## Handoff

PROGRESS.md: final route map, components parked for later phases.
