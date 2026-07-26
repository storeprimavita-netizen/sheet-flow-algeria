# PROGRESS — living handoff file

Every execution chat APPENDS a block here when its phase is done. Newest at
the bottom. Format:

```
## Phase X — <title> (<date>) — DONE|PARTIAL
- Done: ...
- Files: ...
- Decisions: ...
- Known issues: ...
- Next chat must know: ...
```

## Phase plan (v2)

| Phase | File | Status |
|---|---|---|
| 0 — DB rebaseline + auth foundation | docs/phases/phase-00.md | done |
| 1 — Shell, six-section IA, guards, Slack removal | docs/phases/phase-01.md | done |
| 2 — Settings section | docs/phases/phase-02.md | done |
| 3 — Products (details/expenses/ad-spend/stock) | docs/phases/phase-03.md | done |
| 4 — Pricing engine + Real + tests | docs/phases/phase-04.md | done |
| 5 — Orders core (queues/history/customers/duplicates/cash) | docs/phases/phase-05.md | pending |
| 6 — Webhooks v2 | docs/phases/phase-06.md | pending |
| 7 — Dashboard BI | docs/phases/phase-07.md | pending |
| 8 — Contacts (customers/suppliers) | docs/phases/phase-08.md | pending |
| 9 — Team & Rules | docs/phases/phase-09.md | pending |
| 10 — Polish, seed, RLS tests, deploy | docs/phases/phase-10.md | pending |

## Planning (2026-07-26, Fable) — DONE

- Done: codebase audit (docs/AUDIT.md), final spec (docs/SPEC.md), v2
  workspace-scoped schema `supabase/migrations/00001–00007` (legacy v1 moved
  to `supabase/migrations_legacy/`, superseded), docs/DB.md, docs/TOOLING.md,
  phase files 00–10, CLAUDE.md conventions.
- Decisions (user-approved): clean DB rebaseline (dev data disposable);
  fold cash/stock/workbench/reports into the six spec sections; remove
  Slack; keep EN/AR i18n. Deviations list: docs/SPEC.md §Deviations
  (notably: webhooks stay Next.js route handlers, not Edge Functions).
- Known issues: v1 app code still points at dropped tables until Phase 0/1
  land — the repo builds now but will NOT run against the DB once the reset
  in phase-00 step 1 is executed. Do phases in order.
- Next chat must know: the live Supabase project is `apsulsbdrnlesggzzfak`
  (linked). `BENZ Pricing (31).xlsx` in repo root stays untracked (reference
  only — math already ported + verified in `src/lib/pricing.ts`).
- Tooling update (later on 2026-07-26): user installed **graphify** (CLI
  knowledge graph, `graphify-out/` regenerated — 611 nodes) and **ponytail**
  (Claude Code plugin skills). Usage rules: docs/TOOLING.md + CLAUDE.md
  (session protocol item 5 and §graphify). The earlier "not available" note
  is obsolete.

## Sonnet starter prompt (paste into each new execution chat)

```
Read CLAUDE.md, PROGRESS.md, then docs/phases/phase-XX.md.
Execute that phase only, on branch mnw-XX; read nothing else unless the phase file says so.
Use `graphify query` to orient instead of broad greps; invoke the ponytail:ponytail skill before writing code and ponytail:ponytail-review before merging.
When `npm run build` (and `npm test` once it exists) is green: run `graphify update .`, append your handoff block here, merge --no-ff into mnw.
```

## Phase 0 — DB rebaseline + auth foundation (2026-07-26) — DONE (remote steps completed later same day, see update at end of block)
- Done: all code adapted to the v2 schema; `npm run build` green. `rbac.ts`
  now reads `profiles` (`getProfile()` → `{ role, workspaceId }`); orders/
  products/contacts/expenses/dashboard point at v2 tables and every insert
  sets `workspace_id`; status updates only touch `orders` (triggers write
  `order_status_history`); webhooks read secrets from `integration_configs`
  and upsert `customers` (source enum fixed to `lightfunnels`); enums updated
  (`no_answer`, SUPPLIER_TYPES, ORDER_SOURCES, DELIVERY_TYPES,
  CURRENCY_CODES, AD_KINDS) with EN/AR message keys. Types regenerated from a
  local Supabase (same migrations — regen `--linked` after the remote reset
  should be a no-op). Verified locally: migrations 00001–00007 apply clean and
  `bootstrap_workspace('sh.wailbmg@gmail.com','MNW')` yields 1 workspace,
  1 active admin, 58 wilaya_fees, 5 settings.
- Stubbed ("rebuild pending" placeholder pages, old components deleted):
  settings (Ph2), stock (Ph3), pricing (Ph4), cash + workbench (Ph5 — the
  `assignAgents` action moved to `orders/actions.ts`, assignment card kept),
  bi + reports (Ph7), team + roles (Ph9). Dashboard shows recent orders +
  quick links only; KPI tiles return with the Phase 7 RPC.
- Files: deleted `lib/slack.ts` (Slack removal pulled forward — it read
  `app_settings`), `lib/app-settings.ts`, `lib/pricing-server.ts`, and all v1
  manager components of the stubbed pages. Forms still do client-side inserts
  with a `workspaceId` prop (server-action conversion belongs to each
  feature's rebuild phase). Expense entry is DZD-only for now (`ponytail:`
  comment; currency/fx UI in Phase 3); products low-stock threshold is a
  const (settings key in Phase 3).
- Known issues: webhooks don't yet log to `webhook_events` nor update
  `last_event_at`, and assume a single workspace (Phase 6). Delivery-stage
  comments aren't persisted (v2 has only `confirmation_comment`; history
  trigger logs confirmation comments only).
- Update (same day): remote steps completed. User ran
  `npx supabase db reset --linked` (v2 migrations applied clean). The v1 login
  page has NO sign-up (sign-in only), so the admin auth user was created via
  the Auth admin API: **admin email is `store.prima.vita@gmail.com`** (not
  sh.wailbmg@gmail.com), temp password handed to user to change.
  `bootstrap_workspace('store.prima.vita@gmail.com','MNW')` run via PostgREST
  RPC → workspace `5722eaa0-1342-41dc-8447-f3f680abd3de`, admin profile
  active, 58 wilaya_fees, 5 settings verified on the remote. Types re-gen'd
  `--linked` (only delta: `__InternalSupabase` PostgrestVersion header);
  build green.
- Next chat must know: admin login = `store.prima.vita@gmail.com`. Remaining
  acceptance spot-check deferred: create an agent test user and confirm
  financial blindness (needs a second auth user; natural fit when Phase 9
  team/invites lands — until then RLS policies are the tested wall from
  migration review). A local Supabase db container (`supabase_db_mnw-erp`,
  port 54322) may still be running — `npx supabase stop` to clean up. There is
  no `supabase/config.toml` (project linked, never `init`ed), so
  `gen types --local` fails; use `--linked` or `--db-url`.

## Phase 1 — App shell, six-section IA, role guards, Slack removal (2026-07-26) — DONE
- Done: sidebar (`src/components/app-shell.tsx`) now renders exactly six
  entries (Dashboard, Orders, Products, Contacts, Team, Settings). Admins see
  all six; confirmation/delivery agents see only Orders (SPEC §2 — "nothing
  else"), enforced two ways: nav filter (`role === "admin" ? NAV : orders
  only`) and a real route guard — one shared `AdminGuardLayout`
  (`src/components/admin-guard-layout.tsx`, calls `requireAdmin("/app/orders")`)
  re-exported as `layout.tsx` in `dashboard/`, `products/`, `contacts/`,
  `team/`, `settings/`, and `orders/cash/` (cash reconciliation is admin-only
  even though the rest of Orders is agent-visible). RLS remains the real wall;
  these are UX redirects.
- Route moves/deletions per phase file: `bi` + `reports` deleted (folded into
  Dashboard conceptually — nothing to build yet, Phase 7 owns real BI/export);
  `cash` moved to `orders/cash`; `stock` deleted (parked for Phase 3, no
  `stock-manager.tsx` existed to preserve — Phase 0 already removed all v1
  managers); `workbench` deleted (assignment card already lives in
  `orders/[id]/assignment-card.tsx`); `roles` deleted, merged conceptually into
  `team` (tabs are Phase 9). `expenses` and `pricing` routes were **left
  untouched** — not named in the phase file's move list, still admin-gated by
  their own page-level `requireAdmin` calls from Phase 0, and Phase 3/4 own
  folding them into Products tabs. They're reachable by URL/dashboard quick
  link but no longer in the sidebar (six-entry rule).
- Slack: no `src/lib/slack.ts`, no Slack call in `orders/actions.ts`, no
  `bi/price-calculator.tsx` — Phase 0 already deleted all of that. Only
  leftover was `slackUser`/`slackToken`/`slackChannel` message keys and a
  "Slack" mention in `team.subtitle` (en/ar) — removed. Also removed the
  create-next-app placeholder SVGs in `public/` (unreferenced).
- Files: new `src/components/admin-guard-layout.tsx` +  six one-line
  `layout.tsx` re-exports; `app-shell.tsx` NAV rewritten (dropped the
  `adminOnly`/optional-href/"soon"-badge branch, now dead with only six
  always-linked entries); `dashboard/page.tsx` quick-links fixed (dropped the
  dead `/app/bi` link, `expenses`/`pricing` links now read `expenses.title`/
  `pricing.title` instead of removed `nav.expenses`/`nav.pricing` keys);
  `src/messages/{en,ar}.json` trimmed to the six `nav.*` keys and dropped the
  now-fully-unused `bi`/`reports`/`roles` blocks (kept `stock.*` — still used
  by `products/page.tsx` for low-stock badges — and `cash.*`, `workbench.*`
  pruned to only the keys `assignment-card.tsx` actually uses).
- Known issues: none new. `expenses`/`pricing` are the only routes outside the
  six-section IA and outside a layout guard; they rely on Phase 0's
  page-level `requireAdmin` + RLS until Phase 3/4 absorb them into Products
  tabs.
- Next chat must know: `npm run build` green (no test script yet — N/A gate).
  Orders stays a single flat list in Phase 1 (no all/confirmation/delivery
  subview split) — that's explicitly Phase 5 scope ("Orders core") per the
  phase table, not this phase's "moves, deletions, guards only" mandate.

## Phase 2 — Settings section (2026-07-26) — DONE
- Done: full admin Settings page (`/app/settings`, still behind the Phase 1
  `AdminGuardLayout`) with all six subsections, each its own component +
  server actions in one colocated `actions.ts`: **Workspace** (rename) ·
  **Integrations** (per-provider store domain, secret set/replace — never
  echoed, only a "set/not set" hint — webhook URL + `CopyButton`,
  `last_event_at` health badge) · **Delivery fees** (58-row `wilaya_fees`
  grid, single bulk-save form) · **Fixed fees** (CRUD; currency picker
  silently resolves `fx_rate` via the `current_fx_rate` RPC at save time,
  `amount_dzd` shown from the generated column) · **Exchange rates**
  (append-only insert + current-rate cards via `current_fx_rate` + history
  table) · **Thresholds** (`return_fee`, `duplicate_window`, `risk_weights`,
  `stop_shipping_rule`, `meeting_schedule` — fixed 5-slot editor, blank time =
  slot unused).
- Decisions: every form is a plain `<form action={serverAction}>` — zero
  `"use client"` components anywhere in this phase. Fixed-fee row
  edit/delete uses one form with a second submit button's `formAction`
  override (native, no per-row client JS). Bulk wilaya-fee save re-queries
  the 58 `wilaya_code`s server-side rather than shipping them as hidden
  inputs. This deliberately diverges from the client-side-insert pattern
  contacts/products/expenses still use (Phase 0 debt) — CLAUDE.md and this
  phase file both call for server actions + zod, so Settings sets the
  target pattern for later phases to convert older forms toward.
  `src/lib/settings.ts` added (`getSetting`/`setSetting`, zod schema per
  key, seeded defaults mirroring `seed_workspace()`), replacing the deleted
  v1 `app-settings.ts` per the phase brief. **zod added as a new dependency**
  (package.json/package-lock.json) — first use in the repo; CLAUDE.md
  already mandated it but it was never installed.
- Files: new `src/lib/settings.ts`; new
  `src/app/app/settings/{actions,workspace-section,integrations-section,
  fees-section,fixed-fees-section,exchange-rates-section,thresholds-section}.tsx`;
  `src/app/app/settings/page.tsx` rewritten (was the `Empty`/rebuildPending
  stub); `src/messages/{en,ar}.json` settings block replaced (old
  per-provider `lightfunnelSecret`/`shopifySecret`/`webhooks*` keys removed,
  ~25 new `settings.*` keys added, plus `fields.label`/`fields.currency`);
  `dashboard.modules.Settings.desc` updated to match the new subtitle.
- Known issues: **audit_log verification was not executed against the live
  DB** — the auto-mode permission classifier blocked a throwaway
  service-role script that would've upserted `settings` and read
  `audit_log` back, flagging it as an unauthorized live-data mutation. The
  `audit_row()` triggers on `wilaya_fees`/`settings`/`fixed_fees`/
  `exchange_rates`/`integration_configs` are unchanged from migration 00002
  (already reviewed in Phase 0), so this is very likely fine, but the
  phase's explicit "check via SQL" acceptance step is unconfirmed live —
  worth a 30-second look in the Supabase SQL editor after saving something
  on the page once. Agent-role redirect out of `/app/settings` was verified
  by inspection (same `AdminGuardLayout` as every other admin section from
  Phase 1) but not by logging in as an agent — no second test user exists
  yet (same gap noted at the end of Phase 0, still deferred to Phase 9).
- Next chat must know: `npm run build` green, `graphify update .` run.
  Phase 3 (Products) can now read real `fixed_fees`/exchange-rate data for
  its cost rollups instead of stubs. The `expenses` route is still
  DZD-only/client-insert (Phase 0 debt, `ponytail:` comment) — Phase 3 owns
  folding it into Products and would be a natural place to also convert it
  to the server-action pattern this phase established.

## Phase 3 — Products (details/expenses/ad-spend/stock) (2026-07-26) — DONE
- Done: full Products section minus the Pricing tab (Phase 4). Product page
  is four routed tabs — Details (`[id]/page.tsx`), Expenses (`[id]/expenses`),
  Stock (`[id]/stock`), Statistics (`[id]/statistics`) — under a shared
  `[id]/layout.tsx` that renders plain server-rendered nav links (no active-tab
  highlight, no client JS — skipped as unrequested polish). All mutations
  (product+cost, expenses, stock movements, ad-spend) are server actions +
  zod in one colocated `src/app/app/products/actions.ts`, following the
  Phase 2 Settings pattern exactly (plain `<form action={...}>`, `.bind(null,
  id)` for edit/delete like `saveFixedFee`, zero `"use client"` except two
  small shared widgets below) — this finishes converting Phase 0's
  client-insert product/expense forms to the CLAUDE.md-mandated pattern.
- Decisions: **deleted the standalone `/app/expenses` route** (4 files) and
  folded its CRUD into the product's Expenses tab as inline row-forms
  (mirrors `fixed-fees-section.tsx`'s edit/delete-via-`formAction` pattern) —
  expenses were never part of the six-section IA, this was Phase-0/1 debt
  explicitly flagged for this phase to fold in; dashboard quick-links updated
  to drop the now-dead `/app/expenses` link. Extracted `fxRateFor` →
  `src/lib/fx.ts` and the settings `adminProfile()` helper →
  `rbac.ts:requireAdminProfile()` since both Settings (Phase 2) and Products
  needed identical copies — deduped instead of copy-pasting a third time;
  `settings/actions.ts` now imports both, behavior unchanged. New shared
  `src/components/currency-rate-fields.tsx` (client, no state — plain
  `onChange` DOM write) handles "pick a currency, rate auto-fills but stays
  editable" for Expenses rows and the ad-spend widget; the product Details
  page's sourcing-cost card deliberately does **not** use it — mirrors
  `fixed_fees` instead (currency picker only, rate resolved silently server-
  side via `current_fx_rate` at save), since sourcing cost is a single stable
  value like a fixed fee, not a per-entry rate an admin tunes. Built
  `src/components/ad-spend-entry.tsx` per the phase brief's exact shape:
  fixed to one product via `productId` on the product page, falls back to a
  product `<select>` when reused without it (Phase 7 Dashboard hook already
  wired, just needs a call site). Statistics tab computes net profit inline
  in `[id]/statistics/page.tsx` (not `src/lib/pricing.ts` — that's the
  separate BENZ scenario engine, Phase 4's file) with the allocation formula
  as a code comment: workspace fixed-fees total × (this product's delivered ÷
  all-products' delivered), all-time since there's no period filter yet
  (Phase 7 BI). Manual stock entry only allows `purchase`/`correction`
  (`delivered`/`returned` are the order-status trigger's job, Phase 5);
  movement history has no edit/delete — it's an append-only ledger, deleting
  a row would desync the trigger-maintained `products.stock`.
- Fixed in passing: `stock.reasons.*` message keys (`initial/restock/order/
  return/adjustment/removal`) were leftover v1 wording that never matched the
  real `stock_reason` enum (`purchase/correction/delivered/returned`) —
  replaced in both `en.json`/`ar.json` since the Stock tab renders them.
  Added `MANUAL_STOCK_REASONS`/`LOW_STOCK_THRESHOLD` to `lib/enums.ts` so the
  reason list and the low-stock magic number each have one home instead of
  being copy-pasted between the list page and the new Stock tab. Also
  dropped the dead page-level `requireAdmin()`/`getProfile()` calls in
  `products/new` and `products/[id]` — redundant since Phase 1's
  `AdminGuardLayout` already guards the whole `/app/products` tree.
- Files: new `src/app/app/products/actions.ts`, `src/lib/fx.ts`,
  `src/components/{currency-rate-fields,ad-spend-entry}.tsx`,
  `src/app/app/products/[id]/{layout.tsx,expenses/page.tsx,stock/page.tsx,
  statistics/page.tsx}`; rewrote `product-form.tsx` (server action, added
  variants/images/sourcing-cost fields) and `products/page.tsx` (image
  thumbnail, cost-total column via `product_costs` embed, inline quick-
  status-change form); deleted `src/app/app/expenses/` (4 files); trimmed
  `dashboard/page.tsx` quick-links; `rbac.ts` gained `requireAdminProfile`.
- Known issues: the `stock_movements` → `products.stock` trigger effect was
  verified by reading migration `00003_products.sql` only, not exercised
  against a live DB this session (no live DB access here — same class of gap
  as Phase 2's audit_log note). Statistics tab will show all zeros/— in every
  workspace until Phase 5 (Orders) produces real rows — expected, not a bug;
  the net-profit/allocation formula itself is unverified against real
  numbers for the same reason. Expense→supplier linking is a raw UUID text
  input (per the phase brief, Phase 8 builds the real picker) — a typo
  surfaces as a Postgres FK error, not a friendly message.
- Next chat must know: `npm run build` green (still no test script — N/A
  gate), `graphify update .` run. **Phase 4** re-adds the Pricing tab into
  `[id]/layout.tsx`'s tab list and owns `src/lib/pricing.ts` +
  `product_scenarios` — should not need to touch this phase's sourcing-cost
  card beyond reading `product_costs`. **Phase 5** (Orders) is what turns
  Statistics-tab numbers non-zero, and owns wiring the `delivered`/`returned`
  stock-movement writes (trigger already exists per `docs/DB.md` §Order
  triggers, just needs live orders). **Phase 7** (Dashboard BI) reuses
  `AdSpendEntry` — call it without `productId`, pass a `products` list —
  and should read this phase's net-profit formula comment before adding any
  aggregate/period-scoped version of it.

## Phase 4 — Pricing engine: scenarios + Real column + tests (2026-07-26) — DONE
- Done: ported v1's `<ScenarioEngine>` (found via `git log --all -- src/app/app/
  pricing/scenario-engine.tsx`, deleted in Phase 0) to v2 as
  `src/app/app/products/scenario-engine.tsx` — same debounced (700ms)
  autosave + partial-unique select-then-insert/update save pattern, now
  targeting `product_scenarios` (workspace-scoped, so the insert branch also
  writes `workspace_id`, unlike v1's single-workspace table). Wired as a 5th
  tab (`[id]/layout.tsx`) at `/app/products/[id]/pricing`, and kept as the
  general planner at `/app/products/planner` (`product_id = null`, static
  segment takes precedence over `[id]` in Next's router — no clash). Deleted
  the standalone `/app/pricing` stub route per Phase 1's deferred fold-in;
  dashboard quick link now points at `/app/products/planner`.
- Real column: `src/lib/pricing-real.ts` (`realInputsForProduct`) builds a
  `PricingInputs` from `product_stats` (confirmation/delivery rates, sourcing
  cost), `ad_spend_daily` (all-time ÷ orders_received → per-lead €, last-30-
  day average → spend_eur_day), `products.sale_price`, and active
  `fixed_fees`, all converted through the current EUR rate
  (`fxRateFor`). Returns `hasData: orders_received > 0`; the card renders "—"
  everywhere instead of computing when false (matches the Statistics tab's
  existing null-guard convention) since a workspace with zero orders would
  otherwise show a confidently-wrong 0-profit Real column.
- Scenario seeding: `src/app/app/products/pricing-data.ts`
  (`defaultInputs`/`loadScenarios`, also reconstructed from the deleted v1
  `lib/pricing-server.ts`) seeds fresh scenario rows (same baseline for all
  three slugs, matching v1) from `DEFAULT_INPUTS`/`seedForProduct()` (both
  already existed in `pricing.ts`, previously unused) with `euro_price` ←
  `current_fx_rate`, `delivery_fee_da` ← `settings.return_fee` (via
  `getSetting`), and the sum of active `fixed_fees` dumped into
  `salary_month` — v2 doesn't split fixed fees into flexy/salary/rent
  categories like the v1 sheet, and `computeScenario` only ever sums the
  three fields, so one bucket is equivalent. Same bucket choice reused in
  `pricing-real.ts` for consistency.
- Tests: first test infra in the repo — added `vitest` devDependency +
  `npm test` script (`vitest run`), `src/lib/pricing.test.ts`. Pinned values
  were extracted directly from `BENZ Pricing (31).xlsx`'s cell values (parsed
  its `xl/worksheets/sheet1.xml` + `sharedStrings.xml` with Python's
  `xml.etree.ElementTree` — regex parsing corrupted self-closing empty
  cells), not reverse-engineered from the expected output: BEST =
  `DEFAULT_INPUTS` (already in `pricing.ts`) ⇒ net/order 1025.94, net/month
  130037.5 (exact); MEDIUM inputs read off the sheet's MEDIUM SCENARIO block
  (product_price 3000, euro_price 290, lead 2.4€, confirm 70%, delivery 60%,
  delivery_price 400, packaging 30, sale 5400, spend 100€/day, delivery_fee
  130, flexy 2500, location 2000, salary 290000) ⇒ net/order −445.24,
  net/month −233750 (both verified by hand against the formula before
  writing the test). Plus all-zero-input (no NaN/Infinity) and
  `normalizeInputs` edge cases (missing keys, numeric strings, non-numeric
  junk). `src/lib/pricing.ts` formulas untouched, per CLAUDE.md.
- Fixed in passing (ponytail-review pass): the ported `ScenarioCard` briefly
  used the *translated* scenario title for `id`/`htmlFor` on its inputs
  (`${title}_${f.key}`) — would break if any locale's label ever contained a
  space (invalid HTML id) or two scenarios translated to the same string.
  Switched to a stable untranslated `id` prop (`"best"/"medium"/"worst"/
  "real"`), matching v1's original use of `slug`.
- Known issues: not verified in a live browser against a real logged-in
  admin session (no credentials available this session) — confirmed instead
  that `npm run build`/`npm test` are green and that both new routes 307-
  redirect an unauthenticated request to `/login` without a 500 (proxy/guard
  wiring intact). Real column will show "—" throughout until Phase 5 lands
  orders, same expected-zero-data gap Phase 3 already flagged for the
  Statistics tab. Agent financial-blindness for `product_scenarios` was
  verified by re-reading the Phase 0-reviewed RLS policy in
  `00003_products.sql` (admin-only `_adm` policy, no agent select policy) and
  by confirming `/app/products` is fully behind `AdminGuardLayout` — not
  exercised live with a second test user (same deferred gap as every prior
  phase, still parked for Phase 9).
- Next chat must know: `npm run build` and `npm test` green, `graphify
  update .` run. **Phase 5** (Orders) is what makes `product_stats` non-zero,
  which in turn makes the Real column's `hasData` flip true for the first
  time — worth a manual sanity check against a manually-computed scenario
  once real orders exist. **Phase 7** (Dashboard BI) — no dependency on this
  phase's files beyond reading `pricing.ts`/`pricing-real.ts` if it ever
  wants a workspace-level rollup (not requested here, scoped to per-product +
  general planner only).
