# STATS-3 Seasons + unified filter bar (brief)
risk: high · surface: ui · lane: stats  (new table + RLS + change to the KPI SQL contract; qa-reviewer + ui-reviewer)

**Goal:** admin-defined seasons (named date ranges per year) and one URL-state filter bar on Statistics that narrows every rate, table and drill link through the same SQL set (D4).

**Done when**
- Migration `00061_seasons.sql` (latest on v3 is 00060; recheck at merge, CONF-1 holds 00056/57): tables `seasons` (workspace_id, name, sort) and `season_periods` (workspace_id, season_id FK cascade, year int, date_from, date_to, check from<=to, unique(season_id,year)). Checklist: `workspace_id` FK, RLS on, admin-only policies (select/insert/update/delete, UPDATE with USING + WITH CHECK, `public.is_admin()`), `set_updated_at` + `audit_row()` triggers (config), `docs/DB.md` rows, regen types, RLS test with agent sessions. Seed the 6 NAMES only (Ramadan, Eid al-Fitr, Eid al-Adha, summer, back-to-school, winter) via the workspace seed path; NO dates guessed (Hijri moves; admin enters them).
- ONE filter set: `kpi_order_set(p_from,p_to,p_product,p_filters jsonb default null)` gains the extra filters (keys: category text, wilaya int, source order_source, agent uuid = assigned_confirmation_agent, delivery_type). Unknown or malformed key/value = no match never ignored silently; whitelist keys in SQL. `kpi_by_wilaya`, `kpi_by_commune`, `kpi_drill_orders` get `p_filters jsonb default null` and pass it through; old 3-arg `kpi_order_set` dropped after the callers are replaced (avoid default-arg ambiguity). Stay `security invoker`, admin-only, revoke public+anon, grant authenticated (re-grant new signatures).
- Season filter: `?season=<uuid>&year=YYYY` resolves SERVER-side to from/to of that period (explicit `from`/`to` in the URL win; invalid season/year dropped with a visible note). Compare: with a season chosen, a strip shows `kpi_rates` per available year of that season (one `kpi_rates(kpi_order_set(from,to,...))` call per year, max 5 latest), unmatured years neutral (existing `matured`), each year links to the page for that year.
- Filter bar `src/components/stats/stats-filter-bar.tsx` (client, Radix Select/Combobox + `DateRangePicker`, no raw inputs): period, season(+year), product, category, wilaya, source, agent, delivery type; chips with remove; clear all. Carrier and campaign/store are NOT shown (no column yet: CARRIER-1 / STORE-4 add them). Dashboard keeps its period+product bar (spec: dashboard filters = period + product).
- Remember last filters in localStorage as today but include the new keys; `?wilaya=` open-drill stays separate from the `wilaya` filter: filter param name is `f_wilaya` to avoid clashing with the drill param.
- Drill links from table/commune panel carry every active filter to `orders/all` (map keys into its existing params: product_id, wilaya_code, source, agent, delivery_type; add `category`, season already resolved to from/to). Link count == table count.
- Settings: new tab `Seasons` (`/app/settings/seasons`, admin) listing seasons with their year rows; add/edit/delete period (server actions in colocated `actions.ts`, zod, role re-check, translated errors, form not reset on error: use the D62 submit helper if it exists). Reuse `PageHeader/Empty/Field/DeleteButton`. Overlapping years of the same season are allowed; overlapping between seasons also allowed.
- i18n EN/AR parity; four states on the page; no hardcoded colors.

**Files**
`supabase/migrations/00061_seasons.sql`, `docs/DB.md`, `src/lib/supabase/database.types.ts` (regen); `src/lib/kpi.ts` (types only), `src/lib/query-string.ts` (filter parsing + `ordersQs` mapping, one `parseStatsFilters`), new `src/lib/seasons.ts` (resolve season to range, pure); `src/app/(app)/app/statistics/page.tsx` + new `src/components/stats/{stats-filter-bar,season-compare}.tsx`; `commune-panel.tsx`, `wilaya-table.tsx` (links keep filters); `orders/all/page.tsx` (pass `p_filters`); `settings/seasons/{page,actions,seasons-editor}.tsx` + `settings-tabs.tsx`; `src/messages/{en,ar}.json`; nav test untouched.

**Steps (commit+push each)** 1 migration+DB.md+types. 2 SQL tests (RLS + filters). 3 `seasons.ts` + `parseStatsFilters` + unit tests. 4 pass filters through page, drill, `orders/all`. 5 filter bar. 6 season compare strip. 7 settings Seasons tab + actions. 8 i18n, states, screenshots, gate.

**Tests**
RLS: admin CRUD ok; confirmation and delivery agent get 0 rows and cannot write; anon denied; other workspace invisible; period `from>to` rejected. SQL: each filter alone and combined equals a direct count; `p_filters` null == old result (regression vs STATS-2 numbers); unknown key or bad value returns nothing; non-admin gets zero rows from the three functions; drill total == table received per filter combo. Unit: season to range, invalid season/year dropped, explicit dates win, `f_wilaya` vs `wilaya` separate, filters survive into `ordersQs`. Action: non-admin refused, duplicate year refused, error keeps fields.

**Screens (dark+light, EN+AR, 390px):** statistics with season chosen and compare strip; filter bar with chips; empty (filters match nothing, with "clear filters"); settings Seasons (empty, populated, edit period dialog, error). Filter bar must wrap at 390px.

**Edge cases / assumptions**
- Plan lists category, wilaya, source, agent, delivery type as available; `carrier`, `utm/campaign/store` columns do not exist yet: deferred (state in PROGRESS).
- Product category is `products.category` free text (distinct values feed the Category options).
- Season "same across years" = compare strip, not an overlay chart.
- STATS-2-F (todo) touches the same table/panel files: build STATS-3 on current v3, expect small merge there.
- No new DECISIONS row needed; no open owner question.
