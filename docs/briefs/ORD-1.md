# ORD-1 brief (rev 1, after review 0) — order number `#0001` (D57) + frozen-column state fix
risk: high · surface: ui · lane: orders (M: migration 00050)

Goal: every order gets a DB-assigned per-workspace running number shown as `#0001` everywhere; the data-table frozen cell follows row hover/selected/focus.

## Done when
- `orders.order_seq` int not null default 0, `check (order_seq > 0)`, unique `(workspace_id, order_seq)`, assigned on insert by trigger (manual, webhook, store, swap_order, seed), never reused, immutable.
- Counter is not reachable by any client role (own table, no policies, no grants).
- Existing orders numbered per workspace by `(coalesce(placed_at,created_at), created_at, id)`; `updated_at` untouched.
- No screen, CSV, sort or search uses `order_number ?? id.slice(0,8)`; platform code stays secondary in order sheet/page only.
- `SEED-xxxx` gone from seed (one order keeps a platform `order_number` for screenshots).
- Frozen first column tints with selected / hover / focus in dark, light, LTR, RTL, every table; focus ring visible on it.

## Drift found
`orders.order_number text` (00004) is the EXTERNAL platform ref (webhook.ts 250/407/441, seed) so the new column is `order_seq`. No order search exists (palette searches customers only). Note for STORE-4/tracking: seq is enumerable, never key public lookups on it.

## Migration 00050_order_seq.sql (hand-numbered; check latest file first)
1. `order_counters(workspace_id uuid pk fk workspaces on delete cascade, next_seq int not null default 1)`; RLS enabled, NO policies, `revoke all` from anon, authenticated. Backfill a row for every workspace (`coalesce(max(order_seq),0)+1`, so empty workspaces get 1); AFTER INSERT trigger on workspaces creates its row (security definer).
2. `alter table orders add order_seq int not null default 0`; backfill with `row_number() over (partition by workspace_id order by coalesce(placed_at,created_at), created_at, id)`, wrapped in `alter table orders disable trigger set_updated_at` ... `enable trigger` (00004:259). Assert in a `DO` block: ordering correct, `updated_at` unchanged, no gaps. Then check + unique.
3. BEFORE INSERT trigger `orders_assign_seq` (security definer, `set search_path = public, pg_temp`): `update order_counters set next_seq = next_seq+1 where workspace_id = new.workspace_id returning next_seq-1 into new.order_seq` (row lock serializes; ignores supplied value; upsert row if missing). Revoke execute from public/anon/authenticated. Rolled-back inserts roll back the counter, so gapless.
4. BEFORE UPDATE trigger refusing change of `order_seq` or `workspace_id` (all roles incl. service).
5. Checklist: `docs/DB.md` (table + column + trigger); regen types with explicit `npx supabase gen types typescript --db-url <local url> > src/lib/supabase/database.types.ts` (`--local` fails); default 0 keeps `TablesInsert<"orders">` callers (webhook.ts:291, orders/actions.ts:393, seed) compiling.

## Files
- `src/lib/format.ts`: `formatOrderNo(seq)` -> `#0001` (pad 4, grows past 9999; 0/negative -> `—`); CSV uses same `#0001` text. Render in UI via `<bdi dir="ltr">` (RTL bidi), also for the platform-ref line.
- Replace display (selects add `order_seq`): orders/all (table, CSV, sheet ~313, sort), confirmation (table, sheet, page), delivery (table, kanban, view), cash/page (4 spots), `[id]/page`, swap-card, `_lib/swap-links.ts`, `src/components/swap-badge.tsx:12`, contacts (page, [id], customers-table), products/[id]/orders.
- Sort: `orders/all/page.tsx:18-21` `SORT_COLUMNS.order_number` and column id at `orders-all-table.tsx:118` map to `order_seq`.
- Number column: `min-w-[5ch] whitespace-nowrap`, identity number `text-sm font-medium text-foreground`; duplicate/swap badges may widen the cell (`orders-all-table.tsx:122-140`). Muted `text-xs` only for the platform-ref line (label "Platform ref", i18n). Tab title and `aria-label` "order #0001".
- `orders/all/page.tsx` `q`: zod `^#?\d{1,9}$` -> strip `#`, `eq order_seq`; otherwise fall back to existing name/phone search; never swallow the query error. Empty state shows the query + "Clear search" action + removable chip.
- `command-palette.tsx`: admin-only entry (`/app/orders/all` is adminOnly, nav-model.tsx:68), only when query non-empty, Lucide `Hash`, unique `value` + `forceMount`, routes to `/app/orders/all?q=`. en/ar keys in parity (palette, open-order, platform-ref, empty-search, clear).
- `scripts/seed-dev.ts` ~503/587: drop SEED-/SEED-DUP- order_number (null), keep one platform code.
- `components/data-table/data-table.tsx` (~259-360): `--row-bg` on `<tr>` is the single source for `<tr>` (`bg-(--row-bg)`) and sticky `td`. Default surface; hover/focus surface-raised; selected `color-mix(in oklab, var(--primary) 5%, var(--surface))`; selected+hover/focus a stronger opaque mix. Keep today's precedence (focus over selected). `transition-colors` on both or neither. Put the focus ring/outline on the sticky td too. Sticky `th` stays surface. Variables only; `start-0` logical.

## Steps (each pushed)
1 migration + DB.md + types. 2 RLS/concurrency tests. 3 `formatOrderNo` + test. 4 orders/all + confirmation + delivery + swap-badge. 5 cash, [id], swap, contacts, products. 6 `q` + palette + i18n. 7 seed. 8 data-table fix. 9 screenshots.

## Tests
`orders.order_seq.rls.test.ts`: sequential per workspace; two workspaces independent; zero-order and brand-new workspace get 1; 20 concurrent inserts unique+gapless, also with one failing (bad FK/check); RLS-rejected foreign insert leaves counter unchanged; supplied value ignored; update of `order_seq`/`workspace_id` refused for admin, agent, service; delete does not reuse; admin PATCH of counter fails and authenticated cannot read/write `order_counters`; `swap_order`, manual `createOrder`, webhook insert each get seq. Backfill order and `updated_at` checked in the migration `DO` block only. `format.test.ts`: 1, 9999, 10000, 0, negative. `q` parsing test: non-numeric, `#`, leading zeros, out of range.

## Screenshots (store in `docs/design/audit/ORD-1/`)
orders/all, confirmation (admin and agent session), delivery table+kanban, order page/sheet with platform ref, contacts/[id], products/[id]/orders, cash, swap badge: dark+light, EN+AR; 390px width; palette in AR dark; select + hover + keyboard focus (arrows) + horizontal scroll to see frozen tint.

## Decisions
None new (D57 covers it).
