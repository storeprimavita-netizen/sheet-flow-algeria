# ORD-1 brief — order number `#0001` (D57) + frozen-column state fix
risk: high · surface: ui · lane: orders (M: migration 00050)

Goal: every order gets a DB-assigned per-workspace running number shown as `#0001` everywhere; the data-table frozen cell follows row hover/selected/focus.

## Done when
- `orders.order_seq` exists, not null, unique per workspace, assigned on insert (any path: manual, webhook, store, seed), never reused, immutable.
- Existing orders numbered per workspace by `(placed_at, created_at, id)`; counter continues after the max.
- No screen, CSV export or ⌘K shows `order_number ?? id.slice(0,8)` any more; external code stays as secondary text in the order sheet / order page only.
- `SEED-xxxx` gone from `scripts/seed-dev.ts`.
- Frozen first column tints with selected / hover / focused row in dark, light, LTR, RTL, in every table.

## Drift found
`orders.order_number text` already exists (00004) and holds the EXTERNAL platform number (webhook.ts 250/407/441, seed). So the new column is `order_seq`; `order_number` stays as the external ref (secondary). No ⌘K order search exists yet (palette only searches customers); `orders/all/page.tsx` has no `q` filter.

## Migration 00050_order_seq.sql
1. `alter table workspaces add column next_order_seq integer not null default 1`.
2. `alter table orders add column order_seq integer`; backfill with `row_number() over (partition by workspace_id order by coalesce(placed_at,created_at), created_at, id)`; set `workspaces.next_order_seq = max+1`.
3. `order_seq set not null`; `unique (workspace_id, order_seq)`.
4. BEFORE INSERT trigger `orders_assign_seq` (security definer, `set search_path = public`): `update workspaces set next_order_seq = next_order_seq+1 where id = new.workspace_id returning next_order_seq-1 into new.order_seq` (row lock serializes; ignores any supplied value). Revoke execute from public/anon/authenticated.
5. BEFORE UPDATE trigger refusing change of `order_seq` (all roles incl. admin/service).
6. Checklist: workspace RLS unchanged (workspaces not agent-writable; trigger is the only writer); `docs/DB.md` row updated; regen types (`gen types --linked` is owner-only? use the local stack types command used by prior tasks); RLS test with agent session.

## Files
- `src/lib/format.ts`: `formatOrderNo(seq)` -> `#0001` (pad 4, grows past 9999); test in `format.test.ts`.
- Replace display in: orders/all (table col, CSV "Order", sheet line 313, `q` filter), confirmation (table, sheet, page), delivery (table, kanban, view/page), cash/page (4 spots; select `order_seq`), `[id]/page` + swap-card + `_lib/swap-links.ts`, contacts (page, [id], customers-table), products/[id]/orders. Selects add `order_seq`.
- Order sheet/page: show `#0001` as title; platform code (`order_number`, source) as small muted secondary line only when present.
- Number column: `min-w` ~5ch (`w-[5.5rem]`), `text-xs num text-muted-foreground`; use in all orders tables.
- `orders/all/page.tsx`: `q` param, strip `#`/leading zeros, `eq order_seq`; `command-palette.tsx`: "orders matching #..." entry routing to `/app/orders/all?q=`; en/ar keys in parity.
- `scripts/seed-dev.ts` 503/587: drop SEED-/SEED-DUP- order_number (leave null).
- `components/data-table/data-table.tsx` (~259-360): set `--row-bg` on `<tr>` (default surface; hover/focus surface-raised; selected `color-mix(in oklab, var(--primary) 5%, var(--surface))`) and sticky `td` uses `bg-(--row-bg)`; sticky `th` stays surface. Logical `start-0` already used. Only CSS vars, no hardcoded color.

## Steps (each pushed)
1 migration + DB.md + types + RLS test. 2 `formatOrderNo` + test. 3 orders/all + confirmation + delivery. 4 cash, [id], swap, contacts, products. 5 `q` search + palette + i18n. 6 seed. 7 data-table fix. 8 screenshots.

## Tests
`orders.order_seq.rls.test.ts`: sequential per workspace, two workspaces independent, 20 concurrent inserts unique and gapless, supplied value ignored, update refused (admin + agent), delete does not reuse, backfill order by date (migration check on seeded legacy rows). `format.test.ts: formatOrderNo`. Webhook insert gets a seq.

## Screenshots
orders/all, confirmation, delivery table+kanban, order page/sheet, contacts/[id], cash: dark+light, EN+AR(RTL); select + hover a row and scroll horizontally to see the frozen cell tint.

## Notes
- Concurrency: counter row lock; a rolled-back insert burns no number (counter update rolls back with it), so gapless.
- Sticky cell must stay opaque (content scrolls under it) hence var-based, not transparent.
- No new DECISIONS row needed (D57 covers it).
