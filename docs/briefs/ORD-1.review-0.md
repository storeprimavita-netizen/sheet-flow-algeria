VERDICT: FIX
## Summary
Brief review (qa-reviewer + ui-reviewer). The plan is sound, but there are two high design defects in the migration:
the backfill overwrites `orders.updated_at`, which cannot be undone, and admins can write the counter on `workspaces`, which breaks D57 "never reused".
There are also two highs in the frozen-cell design: precedence is undefined and the focus ring is hidden. Several mediums cover typegen, a NULL counter, the sort, a missed display spot, RTL bidi, and the `q` parsing and palette UX.
Revise the brief, then build. No owner decision needed.

## Findings (ranked)

### HIGH
1. **The backfill resets `updated_at` on every order.** Brief step 2. The `set_updated_at` trigger on orders is in `supabase/migrations/00004_orders.sql:259`, so the backfill UPDATE sets `updated_at = now()` on every order. As a result, the dashboard stuck-at-courier count (`dashboard/page.tsx:72`) drops to 0 and cash aging restarts (`finance/overview/page.tsx:57-66`). Once pushed to production, the old timestamps are lost for good. Fix: `alter table public.orders disable trigger set_updated_at;` around the backfill, then re-enable it. Add a check that `updated_at` is unchanged.
2. **The counter is admin-writable through PostgREST.** `00001_core.sql:214` policy `ws_upd` plus the table-level UPDATE grant mean an admin can `PATCH /rest/v1/workspaces {"next_order_seq":1}`. Every later insert then fails with 23505: webhooks retry forever, and manual create and `swap_order` are blocked. Setting it to int max overflows instead. This breaks D57 "never reused", and D42 expects such an invariant to hold even against admins. Agents can also read order volume through `ws_sel`. Fix: put the counter in its own table, `order_counters(workspace_id pk fk, next_seq)`, with RLS enabled, no policies, and grants revoked from anon and authenticated. The security definer trigger is its only writer.
3. **Frozen-cell precedence is undefined.** `src/components/data-table/data-table.tsx:322-352`. Today selected suppresses hover but focus overrides selected, and the brief's wording would flip that. Fix: make `--row-bg` the single source for both the `<tr>` (`bg-(--row-bg)`) and the sticky td. Define selected+hover/focus as a stronger opaque mix. Add `transition-colors` to the sticky td or remove it from the row.
4. **The opaque sticky td paints over the row focus ring** (`ring-inset` on `<tr>`). Keyboard focus becomes invisible on the frozen cell. Fix: apply the ring or outline to the sticky cell as well.

### MEDIUM
5. **Typegen makes `order_seq` required on Insert.** The column is NOT NULL with no default, so `webhook.ts:291` (`satisfies TablesInsert<"orders">`), `orders/actions.ts:393`, the seed and the tests break, or callers start passing ignored values. Fix: `not null default 0` plus `check (order_seq > 0)`. The check runs after the BEFORE trigger.
6. **`next_order_seq = max+1` is NULL for workspaces with no orders.** Locally 30 of 31 workspaces have none, so the migration fails. Fix: `coalesce(max(order_seq),0)+1`, and seed a counter row for every workspace plus new workspaces (trigger on workspace insert, or upsert in the order trigger).
7. **The sort is not remapped.** `orders/all/page.tsx:18-21` `SORT_COLUMNS.order_number` and column id `orders-all-table.tsx:118` still sort by the external code. Fix: map them to `order_seq`.
8. **A display spot is missing from the file list.** `src/components/swap-badge.tsx:12` uses `to.orderNumber ?? to.id.slice(0, 8)`, and it is used in all-orders, the delivery table and kanban, and `[id]`. Fix: add it.
9. **RTL bidi.** In Arabic text `#0001` can render as `0001#`. Fix: render through `<bdi dir="ltr">` (or a `dir="ltr"` span) wherever `formatOrderNo` output is shown, including the secondary platform-ref line.
10. **`q` parsing and palette.** Non-numeric `q` becomes NaN, the PostgREST error is swallowed, and the page shows a false "no orders". Fix:
    - Zod `^#?\d{1,9}$`, otherwise ignore it or fall back to the existing name and phone search.
    - Empty state that shows the query, with a "Clear search" action and a visible removable chip.
    - Palette entry for admins only, since `/app/orders/all` is `adminOnly` (`nav-model.tsx:68`). Use a Lucide `Hash` or `ShoppingCart` icon, a unique `value`/`forceMount` so cmdk filtering does not hide it, and show it only when the query is non-empty.
11. **Number column width.** A fixed `w-[5.5rem]` clips the duplicate and swap badges that share the sticky cell (`orders-all-table.tsx:122-140`) and wraps from `#10000` up. Fix: `min-w-[5ch] whitespace-nowrap`, with badges allowed to extend the cell. Use `text-sm font-medium text-foreground` for the identity number; muted is for the secondary line only.

### LOW
12. Use `search_path = public, pg_temp` (D55). The immutability guard should also refuse `workspace_id` changes.
13. The order sheet/page secondary line needs a translated label ("Platform ref"), plus the browser tab title and the `aria-label` "order #0001". Add i18n keys in both en and ar: palette entry, open-order, platform-ref label, empty-search text, clear.
14. The CSV format is unspecified. Use the `#0001` text and say so.
15. Types: `gen types --local` is known to fail, so name the `--db-url` command explicitly.
16. Seed: keep at least one order with a platform `order_number` so the secondary line can be screenshotted.
17. Screenshot plan: add 390 px width, keyboard focus (arrow keys), the palette in AR dark, an agent session on confirmation, products/[id]/orders, and the swap badge. Store the shots under `docs/design/audit/ORD-1/`.
18. Note for STORE-4 and tracking: running numbers can be enumerated, so never key public lookups on `order_seq`.

## Missing tests
- An admin PATCH of the counter fails, and authenticated users cannot read or write the counter table.
- `orders.updated_at` is unchanged by the backfill.
- A workspace with zero orders gets seq 1. A brand-new workspace gets seq 1.
- `swap_order` replacement, manual `createOrder` and a webhook insert each get a seq.
- 20 concurrent inserts with one failing (bad FK or check) stay gapless.
- An RLS-rejected insert into a foreign workspace leaves that workspace's counter unchanged.
- An update of `order_seq` or `workspace_id` is refused for admin, agent and service role.
- `q` with non-numeric, `#`-prefixed, leading-zero and out-of-range input.
- Backfill ordering asserted in a `DO` block inside the migration, not as a permanent live test, because later webhook orders with old `placed_at` would break it.
- `formatOrderNo` for 1, 9999, 10000 and 0/negative input.
