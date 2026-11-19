VERDICT: FIX

## Summary
Brief review (review-0) by qa-reviewer + ui-reviewer, no code yet. The design direction is sound, but it rests on a column that does not exist (`products.category`), a `p_filters` design whose casts throw instead of returning no rows, an incomplete drop of the old function versions (PostgREST PGRST203), and a compare strip that cannot be built through the API without the 1000-row cap. Drill link parity breaks on `agent`/`category`. Revise the brief, then re-review. No owner decision needed.

## Findings (ranked)

### High
1. **`products.category` does not exist** — brief "Edge cases" l.28, Done-when l.8. 00014 replaced it with `category_option_id` (FK → `options`, set `product_category`; docs/DB.md:53). Failure: SQL filter and Category options built on a missing column. Fix: key `category` = option uuid, compared as `p.category_option_id::text`; options from the `product_category` option set.
2. **Malformed `p_filters` throws instead of matching nothing** — Done-when l.8. `(p_filters->>'wilaya')::int`, `::order_source`, `::uuid` throw on bad text; `jsonb_object_keys` throws on non-object; `{"source":null}` yields SQL NULL so `x is null or …` silently ignores the filter. Failure: a crafted URL 500s the Statistics page, or a filter is silently dropped. Fix: never cast user values; compare as text (`o.source::text = p_filters->>'source'`, `o.wilaya_code::text`, `assigned_confirmation_agent::text`); test presence with `p_filters ? 'k'`, wrap in `coalesce(…, false)`; guard `jsonb_typeof(p_filters)='object'`; whitelist keys (unknown key → no rows); treat `'{}'` as null.
3. **Old function signatures remain** — Done-when l.8. `create or replace` with an extra arg creates a second overload of `kpi_by_wilaya`, `kpi_by_commune`, `kpi_drill_orders` (and `kpi_order_set`). Failure: RPC calls fail with PGRST203 / "function is not unique". Fix: explicitly `drop function` all four old signatures in 00061, re-run revoke public/anon + grant authenticated on the new ones. Also name the other `kpi_order_set` callers that must keep working: `kpi_lines`, `dashboard_stats`, `pnl_lines`/`pnl_summary` (00031:141,143,296,348,388).
4. **Season compare strip unbuildable as written** — Done-when l.9. The page cannot pass `kpi_order_set(...)` into `kpi_rates` through PostgREST without fetching ids first, capped by `max_rows = 1000` (supabase/config.toml:19). Failure: silently wrong rates on shops with >1000 orders in a period. Fix: add an admin-gated, `security invoker` SQL function, e.g. `kpi_set_rates(p_from,p_to,p_product,p_filters)` = `kpi_rates(array(select id from kpi_order_set(...)))`; add to Files; call years in `Promise.all` inside a Suspense boundary.
5. **Drill link count != table count for `agent` and `category`** — Done-when l.12, `orders/all/page.tsx:110`. Non-drill `?agent=` matches confirmation OR delivery agent; the stats filter uses confirmation agent only. `orders/all` has no `category` param. Failure: same URL returns different sets with/without `drill`. Fix: distinct param (e.g. `conf_agent`) and add `category`; or route every filter-carrying link through `kpi_drill_orders` with `p_filters`, and state which path serves a link with filters but no metric. Also pick ONE channel for delivery type (`kpi_drill_orders` already has `p_delivery_type`).

### Medium
6. **Season seed duplicates and misses existing workspaces** — Done-when l.7. `scripts/seed-dev.ts:714` re-runs `seed_workspace`; no `unique(workspace_id,name)`. Fix: unique constraint + `on conflict do nothing`; copy the full current `seed_workspace` body when redefining; migration also seeds existing workspaces.
7. **Cross-tenant season link** — `season_periods.season_id` plain FK is checked without RLS; an admin can attach a period to another workspace's season id. Fix: composite FK `(season_id, workspace_id)` → `seasons(id, workspace_id)` (add unique on `seasons(id, workspace_id)`).
8. **localStorage shared with dashboard** — Done-when l.11, `dashboard-filter-bar.tsx:19` (`mnw:dashboardFilters`). Failure: season/source/f_wilaya restored into the dashboard; drill `wilaya` remembered (D65(5)). Fix: separate key `mnw:statsFilters`, explicit persisted-key allow-list, never persist drill `wilaya`, persist `season`+`year` only together. Note the client-side restore flash (skeleton during replace or accept).
9. **"Explicit from/to win" hides the season** — Done-when l.9. Stale/remembered dates override a chosen season while its chip still shows. Fix: picking a season clears from/to; when dates override, show "overridden" state and a `role="status"` note; define year options (only years with a period; year disabled with reason until a season is chosen; default year when season chosen without year).
10. **Filter bar layout undefined for 8 fields** — Done-when l.10. Current grid `sm:grid-cols-[16rem_14rem]` / `sm:w-fit` and `sticky top-0`. Fix: define layout — 2-col at 390px (period col-span-2), auto-fit grid from `sm` at `w-full`, or a "More filters (n)" disclosure for the 5 secondary filters; non-sticky below `sm`; Combobox with search for wilaya/agent/product.
11. **Chips** — existing bar emits separate From/To chips and `focus:outline-none`. Fix: one chip per filter ("Period: a – b", "Season: Ramadan 2025"), `focus-visible` ring, `aria-label="Remove filter: …"`, `<bdi>` around values.
12. **Four states for new parts** — `statistics/loading.tsx` skeleton too small; compare strip has no empty (no periods → link to Settings › Seasons) or per-year error state; page empty state (`page.tsx` ~85) must become one "Clear filters" action. A failed filter RPC must not take down the whole page.
13. **Compare strip and Seasons tab UI unspecified** — define cards (year, received, rates via existing `rate-bar`/`metric-cell`), unmatured = neutral + "in progress" label, newest first, `aria-current` on selected year, note when >5 years exist. Seasons tab: `settings-tabs.tsx` type union + navigation-ia.md + breadcrumb; purpose line; one card per season, shared add/edit dialog form, `DateField`, `formatDate`, `DeleteButton` confirm, "No dates yet" CTA for the 6 seeded names. Decide add/rename/delete season (spec: admins define seasons) or state names are fixed.
14. **Season names not translatable** — seeded English names show in AR. Fix: seed a stable key mapped to messages (fallback to name for admin-added seasons).

### Low
- `f_wilaya`: document param naming for all filters in `query-string.ts`; confirm open-drill panel still works with wilaya filter active.
- Year ownership of seasons crossing New Year (winter) — state the rule (year = year of `date_from`).
- Lowercase uuids in the parser.
- Regen types from the local stack, not `--linked` (AGENTS forbids touching the linked project).
- Migration numbering: other branches hold 00051/00056/00057; recheck at merge.
- Category option list: hide/disable with reason when no categories exist.
- Clear-all only when chips exist; move focus sensibly after chips disappear.

## Missing tests
- `p_filters` = `'[]'`, `'"x"'`, `{"wilaya":"abc"}`, `{"source":"foo"}`, `{"agent":"not-uuid"}`, `{"source":null}`, `{"bogus":1}` → 0 rows, none throws.
- `'{}'` == null == STATS-2 numbers.
- `dashboard_stats`, `kpi_lines`, `kpi_summary`, `pnl_summary` unchanged after old `kpi_order_set` drop.
- `pg_proc`: exactly one signature per changed function name; grants on new signatures (anon denied).
- Period cannot reference a season in another workspace.
- `seed_workspace` twice → still 6 seasons; existing workspaces seeded.
- Compare strip / `kpi_set_rates` correct with >1000 orders.
- Season dropped/overridden when explicit dates present; invalid season/year → visible note.
- Agent and category filters return the same set in drill and non-drill mode; link count == table count per filter.
- Dashboard restore ignores stats keys.
- Screens: compare strip at 390px AR dark+light; filter bar with all 8 filters active (chips wrapping).
