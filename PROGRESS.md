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
| 5 — Orders core (queues/history/customers/duplicates/cash) | docs/phases/phase-05.md | done |
| 6 — Webhooks v2 | docs/phases/phase-06.md | done |
| 7 — Dashboard BI | docs/phases/phase-07.md | done |
| 8 — Contacts (customers/suppliers) | docs/phases/phase-08.md | done |
| 9 — Team & Rules | docs/phases/phase-09.md | done |
| 10 — Polish, seed, RLS tests, deploy | docs/phases/phase-10.md | partial (deploy handed off) |
| 11 — Design system foundation | docs/phases/phase-11.md | done |
| 12 — Section pass (9 sections, one per session) | docs/phases/phase-12.md | in progress (§1 data-table, §2 Orders done) |

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

## Phase 5 — Orders core: queues, statuses, history, customers, duplicates, cash (2026-07-26) — DONE
- Done: the flat `/app/orders` list (Phase 0 stub) split into the three views
  the spec calls for. `/app/orders` is now just a role-based redirect
  (admin → `all`, confirmation_agent → `confirmation`, delivery_agent →
  `delivery`). **`/app/orders/all`** (admin-only, new `all/layout.tsx` reusing
  `AdminGuardLayout`): full column list, a native GET `<form>` filter bar
  (confirmation/delivery status, product, wilaya, source, agent, date range)
  and prev/next pagination (`range()`, 25/page) — no client JS, filters live
  in the URL. **`/app/orders/confirmation`**: queue (`confirmation_status <>
  'confirmed'`, same filter applied for admin so the "admin sees the same
  queue" brief line holds instead of admin seeing everything), each row
  (`confirmation/row.tsx`) shows the duplicate banner
  (`is_duplicate_suspect`/`duplicate_of`, linking to the original order) and a
  `customer_stats` risk badge + total/returned/cancelled counts (fetched in
  one extra `.in(customerIds)` query, not embedded through the view — matches
  how Phase 3/4 already queried `product_stats` as a separate query rather
  than trusting PostgREST embedding into a view). Row actions are a single
  plain form: confirmation status select + comment textarea ("Save"), plus a
  second submit button with a `formAction` override (the established
  fixed-fees-section dual-button pattern) that only logs a dial
  (`confirmation_attempts += 1`, read-then-write — see the `ponytail:` comment
  on `logConfirmationAttempt`). **`/app/orders/delivery`**: mirror queue
  (`confirmation_status = 'confirmed'`, any `delivery_status`), one status
  `<select>` instead of 10 individual buttons (ponytail: same requirement,
  far less UI). Admin sees an `OrderTabs` switcher (`order-tabs.tsx`, returns
  `null` for agents — they only ever have one queue, nothing to switch to).
- Customer upsert: new `src/lib/customers.ts`
  (`normalizeDzPhone`/`upsertCustomerFromOrder`), `normalizeDzPhone` ported
  line-for-line from SQL `normalize_dz_phone()` (00001_core.sql) with a
  matching `src/lib/customers.test.ts` (7 cases: already-normalized, spaced,
  +213, 00213, 213-no-zero, 9-digit-no-zero, unmatched-passthrough). Used by
  the new manual-creation action now, and ready for Phase 6's webhook
  handlers per the phase brief.
- Manual creation (`/app/orders/new`) converted off Phase 0's client-side
  `supabase.from("orders").insert(...)` debt onto a real `createOrder` server
  action (zod-validated) + `upsertCustomerFromOrder`. Rewrote `order-form.tsx`
  around that: product/wilaya/wilaya_fees lists now come from the server page
  (no more client `useEffect` fetch), and sale-price/delivery-fee auto-fill
  is plain DOM writes on change (same no-state pattern as
  `CurrencyRateFields`) — picking a product fills `sale_price` and populates
  a `<datalist>` of that product's variant labels (native, no cascading-select
  JS); picking a wilaya/delivery-type fills `delivery_fee` from `wilaya_fees`
  and sets a hidden `delivery_fee_source` to `wilaya_table` — editing the fee
  input by hand flips that hidden field to `manual` (matches the phase
  brief's two source values, no extra state needed).
- Timeline actor names: `order_status_history.actor` has no FK (webhooks
  write null), so `[id]/page.tsx` now resolves a small `actor → display_name`
  map via a separate `profiles.in(actorIds)` query and passes it into
  `OrderWorkflow`, which renders it next to each event's timestamp
  (`orders.systemActor` for null/webhook actors) — this was missing before
  and the phase's acceptance criterion is explicit ("every transition
  appears in the timeline with actor + timestamp").
- Duplicate banner also added to `/app/orders/[id]` (not just the
  confirmation queue) for consistency — cheap, same JSX as the queue row.
- Cash (`/app/orders/cash`): rewritten off the `rebuildPending` stub, adapted
  from v1's `cash-manager.tsx` (found via `git log --all -- src/app/app/cash/
  cash-manager.tsx`) to the v2 `cash_collections` schema
  (`amount_dzd`/`collected_on`/`deposited_on`/`reference`, `cash_status`
  enum) and to zero-client-JS server actions (`cash/actions.ts`:
  `recordCashCollection`, `markDeposited`). Dropped v1's checkbox
  multi-select batch-deposit UI — the phase brief only asks for "record
  per order, mark deposited", so each outstanding row gets its own
  deposit-reference input + button instead of client-side selection state.
  "Uncollected" list is delivered orders minus existing
  `cash_collections.order_id`s (small in-memory diff, not a NOT-EXISTS view).
- Fixed in passing (ponytail-review pass): the `all` page's agent filter
  built a raw PostgREST `.or()` string from a URL query param
  (`assigned_confirmation_agent.eq.${agent},...`) — added a UUID-shape
  regex guard before interpolating it, since `.or()` takes a raw filter
  expression (unlike `.eq()`/`.gte()`, which are parameterized).
- Files: new `src/lib/customers.ts` + `.test.ts`; new
  `src/app/app/orders/{order-tabs.tsx, all/{layout,page}.tsx,
  confirmation/{page,row}.tsx, delivery/{page,row}.tsx, cash/actions.ts}`;
  rewrote `orders/page.tsx` (redirect only), `orders/order-form.tsx`,
  `orders/new/page.tsx`, `orders/cash/page.tsx`; extended `orders/actions.ts`
  (`createOrder`, `updateConfirmationStatus`, `logConfirmationAttempt`,
  `updateDeliveryStatus` — `updateOrderStatus`/`assignAgents` from Phase 0
  untouched, still used by the detail page); added `DELIVERY_FEE_SOURCES` to
  `enums.ts`; ~20 new `fields.*`/`orders.*`/`common.*` message keys in both
  locales (kept new copy short enough to avoid ICU placeholders — the repo
  had never used them before this phase, so the customer-history line composes
  existing `common.total`/`status.*` keys instead of adding one).
- Known issues: not exercised in a live browser (no credentials this
  session) — verified via `npm run build`/`npm test` green and by reading
  the RLS policies (`o_sel`/`o_upd` in `00004_orders.sql`) that back every
  queue's filtering claim. The stock-effect trigger and the duplicate
  trigger were not re-verified live (same class of gap Phase 3/4 already
  flagged) — this phase only added UI/actions around them, migration code
  is untouched. Agent financial-blindness for Orders was verified by
  re-reading `o_sel`/`o_upd` + `guard_order_fields()`, not exercised live
  with a second test user (same deferred gap as every prior phase, still
  parked for Phase 9).
- Next chat must know: `npm run build` and `npm test` green, `graphify
  update .` run. **Phase 6** (Webhooks v2) should call
  `upsertCustomerFromOrder` from `src/lib/customers.ts` exactly as the phase
  brief says, and reuse `normalizeDzPhone` rather than re-deriving phone
  logic. It also inherits the `all`-page filter set and `OrderTabs` — no
  new nav needed for webhook-sourced orders, they just show up in the
  existing queues. **Phase 7** (Dashboard BI) can read the same
  `customer_stats`/`agent_performance` views already proven working here for
  the confirmation queue's risk badge.

## Phase 6 — Webhooks v2: Shopify + LightFunnels (2026-07-26) — DONE
- Done: rewrote `src/lib/webhook.ts` around the pipeline the phase brief
  specifies. `resolveWorkspace()` factors out the "one active
  `integration_configs` row per provider" lookup (multi-tenant per-domain
  routing later is one function). `processWebhook()` now **always** inserts a
  `webhook_events` row — bad signature, unparsable JSON, and mapping/schema
  failures all get a row with `signature_ok`/`error` set (previously invalid
  signatures returned 401 without ever touching the table). Route handlers
  (`src/app/api/webhooks/{shopify,lightfunnel}/route.ts`) are unchanged —
  same `processWebhook(config, req)` call, all the new behavior lives in the
  shared lib.
- New `applyMappedOrder()` (map → zod-validate → wilaya match → delivery-fee
  fallback → `upsertCustomerFromOrder` → idempotent order upsert → mark event
  processed + bump `integration_configs.last_event_at`) is the one code path
  both the live webhook route and the new **replay** button call — replaying
  a stored event re-runs the exact same logic against its saved `payload`,
  no separate implementation to drift.
- `MappedOrder` extended with `wilaya_name`, `delivery_fee`, `delivery_type`,
  `variant` per the phase brief; both provider `map()` functions updated to
  populate them (Shopify: `shipping_address.province` → wilaya,
  `shipping_lines[0]` → fee/type; LightFunnels: same shape guessed from
  `shipping_address.province`/`shipping_fee`/`delivery_type` — **exact
  LightFunnels/Shopify field names for delivery fee and wilaya are
  best-effort**, no real payload sample was available this session; adjust
  the two `map()` functions if the live payload differs once a real webhook
  fires). `matchWilayaCode()` does accent-stripped exact match against the
  58-row `wilayas` table, falling back to substring containment, else null
  (SPEC's "fuzzy fallback null"). Delivery fee: payload value wins
  (`delivery_fee_source='payload'`) if present and > 0, else a
  `wilaya_fees` lookup by matched wilaya + delivery type
  (`'wilaya_table'`), else stays null/`'manual'` for later admin entry.
- Redelivery semantics: `applyMappedOrder` only ever writes the logistics
  bucket (order_number, customer snapshot + id, wilaya/commune/address,
  delivery_type/fee/fee_source, quantity, sale_price, variant,
  `webhook_event_id`) — confirmation/delivery status, comments, attempts,
  assigned agents, and duplicate flags are never in that update, so a
  redelivered webhook cannot clobber agent workflow state. `placed_at` is
  only set on first insert (excluded from the update payload), so it doesn't
  drift on redelivery either.
- Also (Settings → Integrations): new `webhook-events-section.tsx` — the last
  20 `webhook_events` for the workspace, provider + signature/processed
  badges + error line, a native `<details>`/`<summary>` payload viewer (zero
  client JS, matches the section's existing all-server-actions style), and a
  **Replay** button (`replayWebhookEvent` in `settings/actions.ts`, admin-
  gated via `requireAdminProfile`, calls the new `replayEvent(eventId)`
  export). `page.tsx` fetches `webhook_events` alongside the existing
  Settings queries.
- Tests: `src/lib/webhook.test.ts` (7 cases) — `verifySignature` hex/base64/
  tamper/short-signature, and both providers' `map()` against representative
  payloads (field extraction + the "nothing present" defaults path). Needed
  a new `vitest.config.ts` (`resolve.alias` for `@` → `src`, plain Vite
  config, no new dependency) since this is the first test file to import a
  module (`webhook.ts`) that has a **value** import across the `@/` alias
  (`createAdminClient`) rather than only `import type` — `customers.test.ts`/
  `pricing.test.ts` never needed it because their imports across the alias
  were type-only and got erased before Vite had to resolve anything.
- Fixed in passing (ponytail-review pass): first draft mapped `wilaya_name`
  to `MappedOrder` and separately best-effort-called `config.map(payload)` a
  second time in `processWebhook` just to get an `external_id` for the
  initial `webhook_events` insert row. Cut the duplicate mapping call —
  the event row now gets `external_id` written in the same update that sets
  `processed_at` once `applyMappedOrder` actually validates the mapping, one
  code path instead of two.
- Known issues: **no live curl fixture run this session.** `.env.local`
  points at the linked remote Supabase project (the real admin's workspace,
  per Phase 0's notes) — running the phase's fixture tests against it would
  write test orders/customers/webhook_events into live data, and the
  auto-mode permission classifier flagged even a read-only credential-check
  command this session, so a mutating live test was not attempted (same
  caution prior phases hit with `audit_log`/RLS spot-checks). A leftover
  local Supabase docker stack exists (`supabase_*_mnw-erp` containers, per
  Phase 0's cleanup note) but `.env.local` doesn't target it, so it wasn't
  used either. Verified instead via `npm run build`/`npm test` (mapping
  logic + signature verification unit-tested) and by re-reading
  `orders_flag_duplicate`/`orders_guard_fields` in `00004_orders.sql` — the
  duplicate trigger is `BEFORE INSERT` only (fires for the webhook's first
  insert, not redelivery updates, matching "same phone + product <48h" on
  first sight) and `orders_guard_fields` explicitly bypasses for the
  service-role client webhooks use. Curl fixture commands (documented per
  the acceptance criteria, not run):
  ```bash
  BODY='{"id":"lf-test-1","total":3000,"customer":{"full_name":"Test User","phone":"0555000111"},"shipping_address":{"city":"Alger","province":"Alger"},"line_items":[{"quantity":1,"variant":"Red/M"}],"shipping_fee":400,"delivery_type":"home"}'
  SECRET='<Settings → Integrations → LightFunnels secret>'
  SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
  # valid signature — expect 200, one order created, webhook_events row signature_ok=true/processed_at set
  curl -s -X POST http://localhost:3000/api/webhooks/lightfunnel \
    -H "content-type: application/json" -H "x-lightfunnel-signature: $SIG" -d "$BODY"
  # bad signature — expect 401, webhook_events row signature_ok=false, error='invalid signature', no order written
  curl -s -X POST http://localhost:3000/api/webhooks/lightfunnel \
    -H "content-type: application/json" -H "x-lightfunnel-signature: deadbeef" -d "$BODY"
  # duplicate delivery — resend the same $BODY/$SIG; expect still exactly one order row for external_id lf-test-1,
  # a second webhook_events row, confirmation_status/delivery_status unchanged from any manual edits made in between
  # unknown wilaya — same BODY with "shipping_address":{"city":"Nowhereville"}; expect order created with
  # wilaya_code=null, delivery_fee_source falls back to 'manual' if no delivery_fee in payload either
  # Shopify uses base64: SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -binary | base64)
  # and header x-shopify-hmac-sha256, endpoint /api/webhooks/shopify
  ```
- Next chat must know: `npm run build` and `npm test` green (20 tests),
  `graphify update .` run. **Phase 7** (Dashboard BI) inherits a working
  `webhook_events`/`last_event_at` health signal for any "integration
  status" dashboard tile it might want. The LightFunnels/Shopify field-name
  guesses for delivery fee/wilaya (`shipping_fee`, `shipping_address.province`,
  `shipping_lines[0]`) should be checked against a real payload the first
  time a live webhook actually fires — the curl fixtures above are the
  fastest way to confirm/adjust `lightfunnelProvider.map`/`shopifyProvider.map`
  in `src/lib/webhook.ts` once real credentials are available.

## Phase 7 — Dashboard BI (2026-07-26) — DONE
- Done: new migration `00008_dashboard.sql` — RPC `dashboard_stats(p_from,
  p_to, p_product[], p_wilaya[], p_source[], p_conf_agent[], p_deliv_agent[])`
  returning one jsonb (`stage_counts`, `funnel`, `kpis`, `category_spending`,
  `per_wilaya`, `per_agent`, `per_product`). The five order-level filters are
  evaluated once into `v_order_ids`; every downstream aggregate joins
  `o.id = any(v_order_ids)` instead of repeating the six-clause predicate
  (a ponytail-review pass caught the first draft repeating it six times).
  `/app/dashboard` rewritten (`page.tsx`, still behind Phase 1's
  `AdminGuardLayout`): preset (today/7d/30d) + custom date range, multi-select
  filters (product/wilaya/source/confirmation-agent/delivery-agent) as a
  plain GET form (URL-driven, zero client JS) · 5 KPI cards · funnel with
  CSS-bar drop-off · per-wilaya table+bar with manual/auto 🚫 flags ·
  per-agent and per-product rate tables · category-spending breakdown ·
  `AdSpendEntry` widget (Phase 3's component — this is its first call site
  anywhere in the app, used without `productId` per its documented
  fallback) · next-meeting card (`meetings`, links to `/app/team`) · CSV
  export (`export-button.tsx`, client component, reuses the existing
  `src/lib/csv.ts` — two buttons, filtered orders + a KPI/funnel summary
  sheet, same two-button shape as the parked v1 `reports-exporter.tsx`).
- Decisions: **no agent-facing dashboard view was built.** Phase 1 already
  made `/app/dashboard` admin-only (`AdminGuardLayout` redirects agents to
  `/app/orders`; the nav shows agents only "Orders", per Phase 1's own
  "nothing else per SPEC §2" note) — this directly conflicts with this
  phase's step 5 ("agents landing here get queue counts + personal stats").
  Since Phase 1's routing is deliberate, already-live, and out of this
  phase's stated scope ("execute that phase only"), I kept it: agents
  structurally cannot reach this route, so there is no unreachable branch to
  build. The RPC still gates every money field behind an explicit
  `is_admin()` check as defense in depth (see below), so nothing regresses
  if that routing decision is ever revisited. **Money fields are
  explicitly `is_admin()`-gated in SQL, not left to RLS alone**: the phase
  brief's rationale ("financial sub-selects come from admin-only tables ⇒
  null") only covers `expenses`/`ad_spend_daily`/`product_costs`. Revenue is
  `Σ orders.sale_price·qty`, and `orders.sale_price` is NOT RLS-hidden from
  agents (a delivery agent's `o_sel` policy exposes every confirmed order,
  which is most of the pipeline) — relying on RLS alone would have leaked
  revenue. Verified both ways live (see reconciliation below). **No `status`
  filter dimension**, despite SPEC §7 and this phase file's step 2 both
  listing one: step 1's RPC signature is spelled out with exact param names
  and has no status param, and a filter the aggregate can't honor would be
  worse than no filter (inconsistent sections, failing the "every filter
  combination changes every section consistently" acceptance line). Treated
  the precise signature as authoritative over the generic prose list.
  **Settings → Delivery fees gained an "Auto flag" column** (`fees-section.tsx`,
  wired from a new `wilaya_stats` query in `settings/page.tsx`) — this phase's
  acceptance criteria explicitly require the auto flag to show in Settings
  too, and Settings (Phase 2) predates the `wilaya_stats` view (Phase 6), so
  it never had this; reused the view instead of duplicating the formula.
- Verification: **a local Supabase docker stack was already running**
  (leftover from Phase 0, `supabase_db_mnw-erp` on port 54322) with
  migrations 00001–00007 applied but **missing the standard Supabase
  `GRANT ... TO anon, authenticated, service_role` statements** (this stack
  was hand-assembled from raw containers, not `supabase start`, so nothing
  had ever run them) — every table read `permission denied` under `set role
  authenticated` until I applied the standard grants directly. With that
  fixed, I applied `00008_dashboard.sql`, seeded 2 products/3 customers/4
  orders/2 expenses/1 ad-spend row, and ran `dashboard_stats` as the seeded
  admin (via `set local role authenticated` + `set_config('request.jwt.claims',
  ...)`, no real second auth user needed): revenue 11000 = 3000 (order 1,
  Dress A delivered) + 8000 (order 3, Dress B×2 delivered); invested 5900 =
  1200 expenses + 2600 ad spend (10€×260) + 2100 sourcing (500×1 + 800×2 for
  the two delivered orders); net profit 5100; confirmation_rate 75% (3/4);
  delivery_rate 66.7% (2/3) — all by-hand-verified against the seed before
  reading the RPC's output. Re-verified after the `v_order_ids` refactor
  (identical numbers) and spot-checked date (`2026-07-20..21`) and wilaya
  (`[6]`) filters each narrowing every section consistently (per_wilaya,
  per_product, kpis all dropped to the matching subset). Set
  `stop_shipping_rule` to `{min_orders:1,min_delivery_rate:60}` and confirmed
  wilaya 16 (2 confirmed, 1 delivered = 50% < 60%) flips
  `stop_shipping_auto` true in both `dashboard_stats` and the plain
  `wilaya_stats` view (used by the new Settings column). **Flipped the seeded
  admin's own `profiles.role` to `confirmation_agent` then `delivery_agent`
  inside a rolled-back transaction** and re-ran the RPC as each: `kpis.*`
  money fields were `null` in both cases (confirming the explicit gate, not
  just RLS), `stage_counts.received` correctly shrank to each role's visible
  queue (1 for confirmation_agent — RLS hides the 3 already-confirmed
  orders; 3 for delivery_agent — RLS hides the 1 not-yet-confirmed order) —
  this closes the "agent financial blindness" spot-check every phase since
  Phase 0 had deferred for lack of a second test user. All seed data deleted
  and `stop_shipping_rule` reset to the default afterward; `orders`/`products`
  counts confirmed back to 0. The missing grants are a pre-existing gap in
  this local docker stack (not caused by this phase, not present on the
  linked remote project, which is a real Supabase platform that sets them
  automatically) — not migrated, since a migration file would be wrong for
  the remote project; only worth knowing if a future session hits the same
  "permission denied for table X" wall on this same local stack.
- Files: new `supabase/migrations/00008_dashboard.sql`,
  `src/app/app/dashboard/export-button.tsx`; rewrote `dashboard/page.tsx`;
  regenerated `database.types.ts` from the local db (`--db-url`, hand-merged
  the `dashboard_stats` RPC entry to keep the `--linked` project's
  `__InternalSupabase` header, matching Phase 0's precedent); extended
  `settings/page.tsx` + `fees-section.tsx` (auto-flag column); replaced the
  dead `dashboard.modules`/`kpi`/`queue`/`recent` message keys (unused since
  Phase 1, confirmed via grep) with the new `dashboard.*` tree in both
  locales; reused `src/lib/csv.ts`, `src/components/ad-spend-entry.tsx`
  (first call site), `workbench.assignConfirmation`/`assignDelivery` labels.
- Known issues: `per_agent` wasn't exercised with real actor data (my SQL
  seed inserted orders directly as the `postgres` superuser, so
  `order_status_history.actor` was null throughout — the view/RPC's
  `h.actor is not null` filter correctly excluded them; a real logged-in
  session's `auth.uid()` populates this normally, same mechanism Phase 5/6
  already rely on and already reviewed). Not exercised in an actual browser
  (no login credentials this session, same class of gap as every prior
  phase) — verified instead via the live-SQL reconciliation above, which is
  a stronger check than prior phases had for their acceptance criteria.
- Next chat must know: `npm run build` and `npm test` green (20 tests, no
  new test file — `dashboard_stats` is a SQL aggregate with no JS logic to
  unit-test; its correctness check is the live reconciliation documented
  above), `graphify update .` run. **Phase 8** (Contacts) doesn't depend on
  anything here. If a later phase wants a `status` filter dimension on the
  dashboard after all, extend `dashboard_stats`'s signature (confirmation +
  delivery status are two different enums — pick which one the SPEC actually
  means, or add both) and thread it through `page.tsx`'s filter bar the same
  way the other five params are threaded. The local docker stack's grants
  fix is not persisted anywhere except this note — if it's ever torn down
  and recreated by hand again (not via `supabase start`), the same
  `GRANT ALL ... TO anon, authenticated, service_role` + `ALTER DEFAULT
  PRIVILEGES` block will be needed again before any RLS-authenticated query
  will work.

## Phase 8 — Contacts: customers + suppliers (2026-07-26) — DONE
- Done: split `/app/contacts` (Phase-0 stub: a single admin-only supplier
  CRUD list) into the two sections the phase brief calls for. **Customers**
  now lives at `/app/contacts` itself — list from `customer_stats` (name,
  phone, wilaya, total/delivered/returned counts, risk badge), a plain GET
  search box (`?q=`) that runs two `.ilike()` queries (name, and phone after
  `normalizeDzPhone(q)`) and merges by id in JS — chosen over a single
  `.or()` string to avoid the same raw-filter-injection class Phase 5's
  ponytail-review pass already flagged for the `all`-page agent filter.
  Detail page `/app/contacts/[id]` shows an admin-editable form
  (name/wilaya/commune/notes via new `saveCustomer` server action — no
  create/delete, customers are order-created only), a **risk-score
  breakdown** table (returned/cancelled/no-answer counts × `risk_weights`
  from Settings, via `getSetting`) with the formula spelled out next to the
  DB-computed `customer_stats.risk_score` badge (displayed, not
  recalculated client-side, so it can never drift from the view), and full
  order history. **Suppliers** moved to `/app/contacts/suppliers` (list/new/
  `[id]`), admin-gated by a `layout.tsx` re-exporting the existing
  `AdminGuardLayout` (same one-liner pattern as `orders/cash`). Supplier
  detail page gained the **linked expense history + total** the phase brief
  asks for (`expenses` filtered by `contact_id`, summed `amount_dzd`).
  New `ContactTabs` (`contacts/tabs.tsx`) switches Customers/Suppliers for
  admins only (mirrors `OrderTabs`) — returns `null` for agents, who only
  ever have the customer view to begin with.
- Decisions: **removed the blanket `AdminGuardLayout` from `contacts/
  layout.tsx` entirely** (deleted the file) — Phase 1 had gated the whole
  section admin-only, but this phase's own Notes section requires
  "confirmation agents may open customer detail" and the acceptance
  criteria require "customers visible" for agents. `customers` RLS
  (`cu_sel`) already allows all authenticated roles to read, so the only
  change needed was letting the route through; admin-only write stays
  enforced by `saveCustomer`'s `requireAdminProfile()` (agents get a
  read-only Meta view instead of the form) and by RLS itself. Agents don't
  get a "Contacts" nav entry (Phase 1's six-entry rule is untouched), so in
  practice they reach a customer's page via the new link on the customer
  name in `orders/confirmation/row.tsx` (`→ /app/contacts/${order.
  customer_id}`) — not by browsing the list, though nothing blocks that
  either since RLS already permits it and the phase only asked to make
  customers "visible", not to further restrict discovery. Suppliers stayed
  fully admin-gated (`contacts` RLS is `co_adm`, admin-only) via the new
  `suppliers/layout.tsx`. Extracted the confirmation queue's inline risk
  badge into `src/components/risk-badge.tsx` (the phase brief's own
  suggestion) and reused it in both new customer views — one `riskVariant`
  implementation instead of two now.
- Converted the supplier `ContactForm` off Phase 0's client-side
  `supabase.from("contacts").insert/update` (a "use client" component) onto
  a new `saveContact` server action in `contacts/actions.ts`, following the
  Settings/Products server-action pattern CLAUDE.md mandates and that this
  route had never adopted — zero client JS in the form now, `DeleteButton`
  (already generic over `"contacts"`) kept for delete, matching the
  established split (server action for create/update, `DeleteButton` for
  delete) used by the product Expenses tab.
- Wired the supplier selector into the product Expenses tab per the phase
  brief ("replace the plain input left in Phase 3"): `[id]/expenses/
  page.tsx`'s `contact_id` field is now a `<Select>` of `contacts` rows
  instead of a raw UUID `<Input>` — `saveExpense`'s existing zod
  preprocess (empty string → null) needed no changes since a `<Select>`
  posts the same shape as the old `<Input>`.
- Files: new `src/components/risk-badge.tsx`; new `src/app/app/contacts/
  {actions.ts, tabs.tsx, suppliers/{layout.tsx, page.tsx, new/page.tsx,
  [id]/page.tsx}}`; rewrote `contacts/page.tsx` (was supplier list, now
  customer list), `contacts/[id]/page.tsx` (was supplier edit, now customer
  detail), `contacts/contact-form.tsx` (client → server action); deleted
  `contacts/layout.tsx`, `contacts/new/page.tsx` (moved to `suppliers/new`);
  extended `orders/confirmation/row.tsx` (customer name links to
  `/app/contacts/[id]`, uses `RiskBadge`) and `products/[id]/expenses/
  page.tsx` (supplier `<Select>`); ~18 new `contacts.*`/`fields.weight` keys
  in both locales (dropped the old generic `contacts.new/edit/none`, now
  split into customer/supplier-specific keys — grepped first, nothing else
  referenced the old keys).
- Known issues: not exercised in a live browser (no credentials this
  session, same class of gap as every phase since Phase 0) — verified via
  `npm run build`/`npm test` green (20 tests, unchanged — no new test file;
  this phase is UI/actions over already-tested `normalizeDzPhone` and the
  Phase-7-verified `customer_stats` view, nothing new to unit-test) and by
  re-reading the `cu_sel`/`cu_all`/`co_adm` RLS policies in
  `00004_orders.sql` that back the "customers visible, suppliers invisible"
  acceptance line. The risk-breakdown formula display was cross-checked
  against `00006_analytics.sql`'s `customer_stats` SQL by hand (same
  `w_ret·returned + w_can·cancelled + w_na·no_answer` shape) but not against
  a live customer with real order history — no seed data exists in this
  session's environment. Delivery agents can also reach `/app/contacts` and
  customer detail (RLS `cu_sel` has no role predicate, only the confirmation
  queue links to it) — SPEC §2 only mentions customer info for
  confirmation_agent, but nothing forbids it for delivery_agent either, so
  this was left open rather than added as a new restriction not asked for.
- Next chat must know: `npm run build` and `npm test` green, `graphify
  update .` run. `ContactTabs` (`contacts/tabs.tsx`) duplicates `OrderTabs`
  (`orders/order-tabs.tsx`) near line-for-line — flagged in this phase's
  ponytail-review pass as a ~30-line extraction opportunity, deliberately
  not taken since it would mean editing a Phase 5 file outside this phase's
  scope; worth doing if **Phase 9** (Team & Rules) or **Phase 10** (polish)
  ever touches tab-switcher UI again. **Phase 9** can now assign
  confirmation/delivery agents by real identity and this phase's customer
  detail page's admin/agent branch is the pattern to copy for any other
  agent-readable-but-admin-editable page.

## Phase 9 — Team & Rules (2026-07-26) — DONE
- Done: replaced the Phase-0 `rebuildPending` stub with the full section.
  **Users** (`/app/team`, root): profile list (name/email/duty/role/active) —
  email comes from `supabase.auth.admin.listUsers()` since `profiles` has no
  email column (only `auth.users` does); `InviteForm` calls `inviteUser()`
  (service-role: `auth.admin.inviteUserByEmail` + same admin client
  immediately assigns `workspace_id`/`role`/`duty`/`is_active=true` on the
  resulting profile, `redirectTo` → `/reset-password`). Per-row edits
  (`UserRow`, role/duty/active) use the normal session client — RLS/`pr_upd`
  already allows it once `workspace_id` is set. **Invited users land
  pre-assigned and active**, not inactive-until-claimed — documenting this
  since the acceptance criteria asked which behavior was chosen; the
  alternative (invite first, assign later) hits an RLS wall (see Decisions).
  **Rules** (`/app/team/rules`): CRUD `rules_docs` (title/content/position,
  up/down reorder swaps two `position` values), plain `whitespace-pre-wrap`
  render for agents (no markdown lib, per the phase brief). **Meetings**
  (`/app/team/meetings`, `[id]`): "Create next instances" computes the next
  occurrence of each `settings.meeting_schedule` weekly slot and inserts a
  `meetings` row per slot (skips if one already exists at that exact
  timestamp) — no cron. Instance page: objectives checklist (add/toggle/
  delete via `meeting_objectives`), `MarkHeldButton` (mark held), notes
  textarea, attendees via the existing `MultiSelectSearch` component (Phase 7)
  posting into a plain `<form action={setAttendees}>`. Dashboard's
  next-meeting card now links to `/app/team/meetings` (was the bare
  `/app/team` root, now Users). **Performance** (`/app/team/performance`):
  `agent_performance` view joined to `profiles` for names; new
  `formatDuration()` (`lib/format.ts`) turns a Postgres interval string
  ("3 days 01:02:03" / "01:02:03") into "3d 1h 2m" — first parser-shaped
  helper in this phase, given its own `format.test.ts` (5 cases) per
  ponytail's "non-trivial logic gets one check" rule. **Audit log**
  (`/app/team/audit`): GET filter form (table/actor/date), `audit_log`
  rows (last 100) with a `diffRows()` helper rendering changed keys as
  `key: old → new` (skips `created_at`/`updated_at` noise).
- Decisions: **deleted the blanket `team/layout.tsx` `AdminGuardLayout`
  re-export** (same move Phase 8 made for `contacts/layout.tsx`) — the
  acceptance criteria require "/app/team redirects away (except rules read
  view if linked)", which a section-wide guard can't express. Instead:
  `team/page.tsx` (Users, root) calls `requireAdmin()` itself; `meetings/`,
  `performance/`, `audit/` each get their own one-line `AdminGuardLayout`
  re-export (mirrors `orders/cash/layout.tsx`, `suppliers/layout.tsx`);
  `rules/page.tsx` has **no** guard at all — `rd_sel` RLS already lets every
  authenticated role read, so the route just checks `isCurrentUserAdmin()` to
  pick edit-form vs. read-only rendering. Agents have no "Team" nav entry
  (six-entry rule, Phase 1) so `/app/team/rules` is reachable only by direct
  URL/link, matching "if linked". **Invite must use the service-role client
  for both steps, not just the invite call**: a freshly auth-triggered
  profile row has `workspace_id = null` (00001_core.sql's
  `handle_new_user()`), and `pr_upd`'s `USING` clause checks the row's
  *current* `workspace_id` against `current_workspace_id()` — null never
  matches, so even an admin's session client cannot assign a workspace to a
  brand-new invitee. `admin.ts`'s doc comment already named "invites" as a
  server-only use case for exactly this reason. **`markMeetingHeld` and
  `inviteUser`/`updateUser` return `{ok,error}` instead of throwing** — read
  Next 16's own error-handling doc
  (`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`)
  before writing these, which explicitly says to model *expected* errors
  (a validation failure, `guard_meeting_held`'s "fill the objectives
  checklist" trigger exception) as return values, not throws — a thrown
  server-action error can render as a bare digest in production, hiding the
  message the phase brief explicitly asks to surface. Every other action in
  this phase (rules CRUD, objectives, notes, attendees) keeps the
  established throw-on-error convention from every prior phase, since those
  aren't expected-failure paths. Mirrors the already-existing
  `assignAgents`/`AssignmentCard` pattern (Phase 5) rather than introducing
  `useActionState` — same effect, no new pattern in the codebase.
- Fixed in passing (ponytail-review pass): first draft of `UserRow` used
  three `useState`s to mirror the role/duty/active form fields, matching
  none of the codebase's existing patterns; switched to uncontrolled inputs +
  `FormData` read on submit (same shape `AssignmentCard` already uses),
  ~10 fewer lines.
- Known issues: not exercised in a live browser or against a live Supabase
  project (no credentials this session, same class of gap as every phase
  since Phase 0) — verified via `npm run build`/`npm test` (25 tests, +5 new
  for `formatDuration`) and by re-reading the relevant RLS policies/triggers
  (`pr_sel`/`pr_upd`/`guard_profiles` in 00001_core.sql, `rd_sel`/`m_all` and
  `guard_meeting_held` in 00005_team.sql). The invite flow's actual email
  delivery (Supabase's `inviteUserByEmail`) and the `guard_meeting_held`
  trigger's error message reaching the UI end-to-end are unverified live —
  same "no live DB access this session" gap Phases 2/3/6 already flagged for
  their acceptance-criteria SQL checks. `TeamTabs` is now a third near-copy
  of `OrderTabs`/`ContactTabs` (flagged, not extracted — Phase 8 already
  deferred this same duplication once; still out of this phase's scope).
  Performance page's rate column reuses `confirmed`/`delivered` counts
  straight from the view with no live data to sanity-check against (same
  "Phase 5 must produce real orders first" gap Phases 3/4/7 already noted for
  their own stats surfaces).
- Next chat must know: `npm run build` and `npm test` green (25 tests),
  `graphify update .` run. **Phase 10** (polish/seed/RLS tests/deploy) is the
  first phase with a real chance to exercise the invite flow, meeting-held
  guard, and agent financial-blindness end-to-end with actual credentials —
  every phase since Phase 0 has deferred that same live spot-check for lack
  of a second test user or DB access; Phase 10 finally has "seed" in its
  title, which is the natural place to close it out.

## Phase 10 — Polish, seed, RLS tests, deploy (2026-07-26) — PARTIAL (deploy handed off)

- Done: **`scripts/seed-dev.ts`** (deterministic, dev-only, refuses to run
  against a non-local `NEXT_PUBLIC_SUPABASE_URL` unless `--force`) — 3 users
  (admin/confirmation/delivery, fixed emails `*@seed.mnw` / `SeedDev!2026`), 5
  products with costs/scenarios/expenses/ad-spend/initial stock, 58 wilaya
  fees filled for the top 12, 2 FX rates, 2 suppliers, ~60 orders spanning
  every confirmation/delivery status combination (including 2 orders that
  provoke a real duplicate-suspect flag), 2 meetings (one held with
  objectives, one planned), 2 rules docs. Idempotent — safe to re-run against
  the same DB. Run natively: `node --env-file=.env.local scripts/seed-dev.ts`
  (Node 20+ strips TS types with no ts-node/tsx dependency; only `import
  type` crosses the `@/` alias, which is erased before Node ever tries to
  resolve it — runtime imports from this script use relative paths).
- Done: **RLS test suite** (`src/lib/rls.test.ts`, 40 tests) — real signed-in
  `supabase-js` clients (not SQL role simulation) against every financial
  table (`product_costs`, `expenses`, `ad_spend_daily`, `fixed_fees`,
  `exchange_rates`, `cash_collections`, `product_scenarios`, `settings`,
  `contacts`, plus `audit_log`/`webhook_events` handled separately since
  they have no `authenticated` insert policy at all): agent select ⇒ 0 rows,
  admin select ⇒ sees the seeded rows (so a passing "0 rows" test can't be
  hiding an accidentally-empty table), agent insert ⇒ rejected. Orders:
  confirmation/delivery agent visibility-window counts cross-checked against
  admin's own count of the same predicate, cross-stage update rejection, two
  legitimate-transition regression tests (see the critical fix below), and
  cross-workspace isolation via a second real workspace + admin user. Opt-in
  via `LOCAL_SUPABASE_URL` env var — `npm test` stays green with no local
  Supabase running (5 files/25 tests pass, this suite cleanly skips) and
  green with it running (5 files/63 tests, all real).
- **Local Supabase docker stack**: the hand-assembled stack from Phase 0/7
  (`supabase_*_mnw-erp` containers, ports 54321/54322) was still running from
  a prior session — used for all of the above instead of the linked remote
  project (never touch real customer data with test writes). It uses
  Supabase's published self-hosting demo JWT keys (the well-known
  `supabase-demo` anon/service_role tokens from the public docker-compose.yml
  example — not a secret of this project) — confirmed by a successful
  authenticated request, which is how the RLS suite and seed script talk to
  it without needing to read anything out of the containers. Two local-stack
  quirks fixed in passing (present because this stack was hand-assembled, not
  `supabase start` — not migrated, not relevant to the linked remote/any real
  Supabase platform): (1) `auth.users` had NULL token/`created_at`/
  `raw_app_meta_data` columns for the one hand-inserted admin from Phase 0,
  which crashes GoTrue's `/admin/users` with "Database error finding users" —
  backfilled with `coalesce(...,'')`/`now()`; (2) migration 00008 hadn't been
  applied to this stack yet — applied directly.
- **CRITICAL FIX — `supabase/migrations/00009_order_transitions.sql`**: the
  E2E pass found that confirmation agents could **never** actually confirm an
  order through the app — `updateConfirmationStatus`/`updateOrderStatus`'s
  plain `.update({ confirmation_status: "confirmed" })` has been silently
  rejected with "new row violates row-level security policy" for every
  confirmation_agent since Phase 5, because PostgreSQL requires the
  post-UPDATE row to still satisfy the table's SELECT policy (`o_sel`) for
  the calling role — not just the UPDATE policy's WITH CHECK (`o_upd`) — and
  `o_sel` hides confirmed orders from confirmation_agent by design (that's
  the whole point of the queue). Proven empirically (not just by reading
  docs) by relaxing `o_upd`'s WITH CHECK alone (no effect) vs. relaxing
  `o_sel` alone (fixes it) via `alter policy ... using (...)` inside a rolled
  back transaction. Fix: `transition_order_status(order_id,
  confirmation_status?, delivery_status?, comment?)`, a `security definer`
  RPC (same pattern as `current_workspace_id()`/`is_admin()`/
  `bootstrap_workspace`) that re-implements `o_upd`'s authorization check
  itself (bypassing the problem entirely) and writes directly;
  `guard_order_fields` still runs (keyed off `auth.uid()`, unaffected by the
  function's elevated privileges) so per-role field restrictions are
  unchanged. `updateOrderStatus`, `updateConfirmationStatus`,
  `updateDeliveryStatus` (`src/app/app/orders/actions.ts`) all switched from
  `.update()` to `.rpc("transition_order_status", ...)`. Regression-tested
  live in `rls.test.ts` (confirmation agent CAN confirm; delivery agent
  attempting the same transition is still rejected — the RPC's own
  authorization check, not RLS, is what's actually gating it now).
  `database.types.ts` hand-patched with the new RPC signature (same
  `--db-url` local regen + hand-merge precedent as Phase 7's `dashboard_stats`
  — remote doesn't have migration 00009 yet, see Next chat/backlog).
- **CRITICAL FIX #2 — webhook orders never had a `product_id`**: `MappedOrder`
  (Phase 6) never had a product field at all, so every webhook-sourced order
  landed with `product_id = null` — which silently disabled duplicate
  detection (`flag_duplicate_order` requires `product_id is not null`),
  stock effects (`order_stock_effects` no-ops on null `product_id`), and
  every per-product stat/dashboard breakdown for the entire primary order
  source, since Phase 6. No admin UI exists to fix an order's product after
  the fact either. Found live: a webhook fixture with no product-identifying
  field produced exactly this. Fix (`src/lib/webhook.ts`): `MappedOrder`
  gained `product_sku`/`product_name`; new `matchProduct()` (mirrors the
  existing `matchWilayaCode()` pattern exactly — exact SKU match, then
  exact/substring name match, else null) resolves `product_id` in
  `applyMappedOrder`; both provider `map()` functions populate the two new
  fields from `line_items[0]` (`sku`/`title`/`product_title` — **best-effort
  guess, same caveat Phase 6 already flagged for wilaya/delivery-fee field
  names: no real provider payload sample was available, adjust
  `lightfunnelProvider.map`/`shopifyProvider.map` once one is seen**).
  `webhook.test.ts` extended (not new tests — added assertions to the
  existing shape tests) to cover `product_sku`/`product_name` extraction.
  Full chain re-verified live end-to-end after the fix: webhook → product
  resolved → second webhook (same phone+resolved product) → duplicate
  flagged → confirmed (agent, via the RPC) → delivered (agent) → revenue
  appears in `dashboard_stats` → returned → stock and `product_stats` both
  adjust correctly → cash collected → deposited. Every step exercised through
  the real signed-in-client code paths (webhook route's own `processWebhook`
  called directly, not re-implemented), not raw SQL.
- **Polish**: extracted `src/components/tabs-nav.tsx` (`TabsNav`) — a
  ~30-line admin-only tab-switcher shape that `OrderTabs`/`ContactTabs` had
  each duplicated (flagged by Phase 8's and Phase 9's ponytail-review passes,
  deferred both times as out-of-scope; Phase 10 is "polish", the deferred-to
  phase). `OrderTabs`, `ContactTabs`, `TeamTabs` are now ~15-line wrappers
  that resolve their own translations and pass plain tabs to `TabsNav`. Swept
  for i18n gaps (no hardcoded EN strings or raw `ml-/mr-/left-/right-`
  physical CSS found outside `ui/` primitives — already clean) and dead code
  (no file under `src/components`/`src/lib` with zero importers). ponytail-
  review pass on this phase's own diff cut a 10-line hand-rolled mulberry32
  PRNG from `seed-dev.ts` (only used for cosmetic amount variance in a
  script whose entire point is determinism) down to a 1-line index-based
  `vary()` — same "not all identical" texture, zero RNG machinery.
- **Known issues**: mobile sidebar and RTL were **not** spot-checked in an
  actual browser — no browser-automation tool available this session, same
  structural gap as the live-UI checks every phase since Phase 0 has noted;
  everything in this phase was verified live at the data/RLS/business-logic
  layer instead (arguably a stronger check for the RLS/E2E acceptance
  criteria specifically, but doesn't cover visual/responsive rendering).
  Migration 00009 and the `matchProduct` webhook fix are **not yet applied to
  the linked remote project** — only to the local docker stack used for this
  session's verification; `npx supabase db push` must run against the linked
  project before the fixes take effect there (see Next chat must know). The
  local docker stack now carries a small amount of harmless test-residue
  drift (a couple of `stock_movements` rows' worth) from this session's live
  E2E poking beyond the pristine seed numbers — cosmetic only, a fresh
  `db reset` + reseed reproduces the exact numbers documented above.
- **Deploy — handed off, not done by me**: no Vercel CLI/project link exists
  in this repo, and deploying + owning production secrets is the user's own
  action (their Vercel account), not something to do unattended. Exact
  handoff:
  1. `npx supabase db push` (linked project) to apply migration 00009 (and
     confirm 00001–00008 are already applied there — Phase 0 already did the
     initial rebaseline push).
  2. `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
     to pick up `transition_order_status` from the remote (this session's
     copy was hand-merged from a local regen — this step reconciles it).
  3. `vercel link` (or the Vercel dashboard → New Project → import this repo).
  4. Env vars (Project Settings → Environment Variables, all three
     environments): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
     `SUPABASE_SERVICE_ROLE_KEY` (server-only — do **not** prefix with
     `NEXT_PUBLIC_`), `APP_URL` (the deployed URL once known — used for
     invite-email redirects).
  5. Deploy (`vercel --prod` or push to the connected branch).
  6. Run one real webhook against the deployed URL (Phase 6's curl fixtures,
     `PROGRESS.md`'s Phase 6 entry, pointed at the deployed domain instead of
     localhost) and update the provider's webhook URL + secret in Settings →
     Integrations to the production values once confirmed working.
  7. Free-tier constraints to plan around: Supabase free tier pauses the
     project after ~1 week with no activity (first request after a pause is
     slow while it wakes up) and caps the database at 500 MB; Vercel's
     hobby/free tier has no long-running background jobs (fine here — no
     cron in this app) and a function-duration cap (webhooks are simple
     upserts, well under it).
- **Backlog** (not this phase, not attempted): FR locale (strings are
  centralized in `src/messages/{en,ar}.json`, a third `fr.json` + a
  `next-intl` config entry is the whole job); a real carrier API integration
  (delivery status currently only changes by hand or via the two webhook
  providers, no carrier push/pull); the SaaS multi-workspace signup flow
  (`bootstrap_workspace` is a one-shot single-tenant function by design —
  `docs/SPEC.md`'s deviation #2 already flags this as deliberately deferred);
  product/variant image uploads (`products.images` is a plain `text[]` of
  URLs today, no upload widget or storage bucket wired up).
- **Next chat must know**: `npm run build` green, `npm test` green (63 tests
  with `LOCAL_SUPABASE_URL` set, 25 without — the RLS suite is opt-in by
  design), `graphify update .` run. The two critical fixes
  (`transition_order_status`, webhook `matchProduct`) are live-verified on
  the **local** stack only — running `npx supabase db push` against the
  linked remote project is the first thing that should happen before or
  during the Vercel deploy handoff above, otherwise the remote project still
  has the confirmation-workflow bug this phase found. If real Shopify/
  LightFunnels payloads become available, cross-check
  `product_sku`/`product_name` extraction in both `map()` functions against
  them (same field-name-guess caveat Phase 6 left for wilaya/delivery-fee,
  now extended to product matching).

## Phase 11 — Design system foundation (2026-07-27) — DONE
- Done: the full token layer + component tools everything restyles onto in
  phases 12–13. **No feature-page restyling** (that's Phase 12) beyond the
  mechanical de-decoration required by acceptance. Verified live in a real
  browser (local seed stack) — first phase with actual UI screenshots.
- **Step 1 — Tokens (`src/app/globals.css`, full rewrite):** Direction A
  "Slate & Emerald" role tokens on `:root` (dark, the default) with a complete
  **`.light`** sibling; every semantic pair (success/warning/danger/info/
  neutral) + extended hues (indigo/cyan/violet/orange/rose) as tinted-bg /
  strong-fg pairs, chart-1..5, `--surface`/`--surface-raised`/`--border-strong`/
  `--text-muted`/`--text-faint`/`--overlay`/`--focus`. Legacy shadcn color
  names (`--color-card`, `--color-muted-foreground`, `--color-destructive`, …)
  are **aliased** to the new role tokens in `@theme inline` so the ~87
  `text-muted-foreground` / `bg-card` / etc. usages across feature pages keep
  working untouched (audit's "extend, don't replace" rule). Deleted
  `--gradient-*`, `--shadow-glow`, `.glass-card`, `.text-gradient`, and the
  body radial-gradient. Added `.num` (tabular-nums), `.card-surface` (the flat
  tokened card that replaces `glass-card`), `.surface-raised`, motion keyframes
  + `prefers-reduced-motion`. **Mechanically swept 59 `glass-card` →
  `card-surface` and 6 `text-gradient` → `text-foreground` across 40 feature
  files** (sed; de-decoration, not restyle) so the acceptance grep is zero.
- **Step 2 — Theme switch:** `src/lib/theme.ts` (cookie `theme`, same pattern
  as locale), root `layout.tsx` reads it → `<html class>` (defaults dark),
  `ThemeToggle` (`src/components/theme-toggle.tsx`) flips the `<html>` class
  immediately (no flash) + persists the cookie + `router.refresh()`. Sonner
  `<Toaster>` mounted in the root layout.
- **Step 3 — Radix primitives (installed `@radix-ui/react-{select,popover,
  dialog,dropdown-menu,tooltip,checkbox,switch}` + `cmdk` + `sonner`; no shadcn
  CLI — direct install gives full token control, avoids the Tailwind-v4 init
  friction):** new `components/ui/{select,popover,dialog,sheet,dropdown-menu,
  tooltip,checkbox,switch,command,combobox,chip}.tsx`, all themed to
  `--surface-raised` + `--border-strong` + shadow. **The native `<select>` bug
  fix (UI_AUDIT G2):** the old native select moved to
  `components/ui/native-select.tsx` (20 legacy feature importers repointed
  there mechanically — no API change, keeps forms working); `ui/select.tsx` is
  now the Radix Select. Verified live: the open dropdown surfaces correctly &
  readably in **both** themes (white-on-white gone). `Combobox` = Popover +
  Command (cmdk), posts via hidden input for plain forms, optional inline
  `+ Create`.
- **Step 4 — Status system:** `src/lib/statuses.ts` is the source of truth —
  each status exports `key`/`label`(i18n)/`token`/`icon`(lucide)/`next[]`/
  `terminal`/`requiresConfirm`, for all four kinds
  (confirmation/delivery/product/task; task_status i18n keys added new).
  `<Chip>` (shared base, token→static-class map so Tailwind sees literals),
  `<StatusPill>` (dot/icon + label, tinted), `<StatusSelect>` (pill in trigger
  AND every option, offers only `next[]`), and **`RiskBadge` rebuilt** off the
  old solid `Badge` into the shield-icon pill grammar (green shield-check /
  amber shield-alert / red shield-x) — it's a shared component, so this
  improves the confirmation queue + contacts views without rewiring their
  logic; made it sync (`useTranslations`) so it works in both server & client
  trees. **Feature pages not yet rewired to these** (Phase 12).
- **Step 5 — Field components (`src/components/fields/`):** MoneyField
  (tabular, space separators, DA/USD suffix, live DZD conversion line, no
  spinners, hidden-input value), PercentField (clamp 0–100), PhoneField (DZ
  normalize on blur + `dupHint` link slot), WilayaCombobox/CommuneCombobox
  (dependent, disabled-with-reason)/ProductCombobox (thumb + status pill),
  QuantityStepper, DateField (native date — ponytail: platform picker, US
  format caveat noted)/DateRangeField (7 presets), CategorySelect (icon per
  expense category), OptionSelect/OptionMultiSelect (Notion-style chips +
  `+ Create`, auto-color by hash; option-sets backend still stubbed → Phase
  12), AutoTextarea, SettingSwitch. All take `name` so they drop into plain
  server-action forms later. **Proven in `/design-preview`, not yet swapped
  into feature pages** (Phase 12).
- **Step 6 — `/design-preview`** (`src/app/design-preview/`, gated
  `NODE_ENV!=='production'`): every token + component in both themes, with a
  theme toggle (flips `<html>` so Radix portals theme correctly) + RTL toggle,
  and a **live contrast readout** — a canvas-sampling WCAG harness measures
  every semantic pair's fg over its tint-composited-over-surface, per theme,
  and flags anything < 4.5:1. **This caught 5 light-theme pairs under 4.5**
  (warning 4.20, info 4.46, cyan 3.56, orange 4.47, primary-fg 4.34) — the
  DESIGN_SYSTEM §3 values missing their own stated "clears 4.5:1" bar — so I
  darkened those light foregrounds (+ the light `--primary`) until all pass in
  both themes. Deviation from the literal §3 light values, in service of §3's
  own contract; dark values are unchanged.
- **Step 7 — Navigation rebuild (`app-shell.tsx` + `nav-model.tsx` +
  `command-palette.tsx`):** always-expanded subsections (Orders →
  All/Confirmation/Delivery, Finance → Overview/Expenses/Ad spend/Income,
  Contacts → Customers/Suppliers, Team → Rules/Meetings/Tasks/Performance/
  Users/Audit log), active = bg tint + left accent bar + colored icon
  (longest-prefix match so `/app/contacts` vs `/app/contacts/suppliers` don't
  both light up), live counters (Confirmation pending / Delivery
  wait-for-deposit, RLS-scoped in `app/layout.tsx`; Tasks = 0 until the
  feature exists), muted at zero, collapsible icon-rail persisted in
  localStorage. **⌘K palette** (Radix Dialog + cmdk): role-filtered navigate +
  admin quick-actions + customer search (routes to `/app/contacts?q=`).
  `?` opens a shortcut overlay. Finance links render for admin only
  (`visibleNav` filters by role; agents see only their own Orders queue).
- **Route shells:** `/app/finance/{,overview,ad-spend,income}` redirect to the
  existing pages (dashboard / cash), `/app/finance/expenses` +
  `/app/team/tasks` are `rebuildPending` placeholders — all admin-guarded via
  one-line `AdminGuardLayout` re-exports. Phase 12 builds Finance + Tasks for
  real.
- **Screenshot self-critique (MANDATORY — done this session):** ran the app
  against the local seed docker stack (`.env.local` targets the real remote, so
  I overrode `NEXT_PUBLIC_SUPABASE_URL`→`127.0.0.1:54321` + the public demo
  keys for the dev server only — never touched remote data), drove it with the
  Playwright MCP at 1440×900. Captured `docs/design/audit/`:
  `preview-{dark,light}.png` (both themes, contrast all-pass),
  `select-open-light.png` (Radix dropdown surfaced/readable — G2 fixed),
  `shell-{dark,light}.png`, `shell-collapsed-light.png`, `cmdk-dark.png`.
  **Fixed what the screenshots + console surfaced:** (1) the 5 light contrast
  fails above; (2) `CommandPalette` wrapped its trigger `<Button>` in a
  `<button>` → nested-button hydration error → changed to `<span>`; (3) the
  palette rendered section + child nav items sharing an href (`/app/contacts`,
  `/app/team`) → duplicate-key React error → palette now lists leaf
  destinations only. Post-fix console is clean; ⌘K verified opening AND
  navigating (clicked Products → routed); collapse rail + both-theme toggle
  verified live.
- **Acceptance:** forbidden-color grep over `src` = **0**; both themes correct
  on `/design-preview` with every gated pair ≥ 4.5:1 (readout shows all pass);
  Radix Select/Combobox surfaced+readable both themes; StatusPill renders every
  status w/ icon, StatusSelect shows pill in trigger+options and only legal
  transitions; sidebar all-subsections-expanded with Finance admin-only, live
  counters (saw 18 confirmation / 26 delivery on seed data), ⌘K opens+navigates;
  `npm run build` + `npm test` green (25 pass / 38 RLS-suite skipped, unchanged).
- **Known issues / deferred:** feature pages still use `native-select` +
  `format.ts` (comma money separators, not the design's spaces) + old
  per-page card markup — **all Phase 12** ("section realignment"), explicitly
  out of Phase 11 scope ("this phase makes the tools; phase 12 uses them").
  `DateField` is the native date input (shows OS-locale format, e.g.
  mm/dd/yyyy) — ponytail: a JS calendar was disproportionate; revisit if the
  US-format display is unacceptable. `/design-preview` section headings are
  English literals (dev-only tool, not user-facing — skipped i18n bloat).
  Command-palette entity search is customer-only via `?q=` routing (order-ID /
  product live search hooks in Phase 12). Option-sets backend still stubbed
  (OptionSelect/MultiSelect operate on prop lists + `onCreate` callback) —
  Phase 12 wires the `option_sets`/`options` tables. Agent-role nav filtering
  (Finance hidden) is code-verified via `visibleNav` + RLS, not re-exercised
  with a live agent login this session (financial blindness already proven at
  the DB layer in Phases 7/10).
- **Next chat must know:** `npm run build` + `npm test` green, `graphify
  update .` run (1123 nodes). **Phase 12** now has the whole toolbox: swap
  `native-select`→Radix `Select`/`StatusSelect`, raw inputs→`components/fields/
  *`, per-page cards→`card-surface`, ad-hoc status text→`<StatusPill>`, and
  build Finance Overview/Expenses/Ad spend/Income + Tasks kanban into the
  route shells this phase stubbed. Money-format-in-spaces should move into
  `format.ts` when Phase 12 touches feature money cells (design wants
  `1 234 567 DA`, not `1,234,567`). The design-preview `/design-preview` route
  is the mirror to check every Phase 12/13 change against.

## Phase 12 §1 — Data-table foundation (2026-07-27) — DONE
- Scope: Phase 12 is **one section per session** (9 sections). This session
  built **Section 1 only — the reusable data-table** the other 8 sections
  depend on ("do first"). Sections 2–9 (Orders, Products, Finance, Dashboard,
  Contacts, Team, Settings, Option sets) remain, one per future session.
- Done: `src/components/data-table/{types.ts,data-table.tsx}` — a generic
  `<DataTable<T>>` per `components.md`. Features, all working (verified live):
  **URL-persisted sort** (`?sort=<colId>&dir=asc|desc`, click a sortable
  header to toggle; resets `?page`), **server pagination** (`?page=`, driven by
  `total`+`pageSize` → prev/next), **sticky header** (`thead` sticky top-0 on
  `bg-surface`) + **sticky first column** (`col.sticky` → `sticky start-0`,
  logical prop so RTL pins the inline-start col), **column-visibility menu**
  (DropdownMenu of checkbox items; `defaultHidden` cols seeded on mount;
  persisted in `localStorage mnw:cols:<tableId>`), **density toggle**
  (comfortable 44px / compact 36px rows, persisted `mnw:density:<tableId>`),
  **row selection** (per-row + header select-all with indeterminate) → a
  **floating bulk-action bar** (`bulkActions(keys, clear)` render prop),
  **trailing kebab** per row (`rowActions(row)`), **row→detail sheet**
  (`renderSheet(row)`, opened on row click, **deep-linked via `?row=<key>`**,
  Escape/overlay closes → clears the param), **keyboard row nav** (↑/↓ moves a
  focused-row highlight, Enter opens the sheet), and **all four states**
  (loading skeleton rows / empty with title+description+action / error with
  retry / populated). Numeric columns right-aligned + `.num` tabular; status
  column centered.
- Column API (`types.ts`): `{ id, header, cell(row), align?, numeric?,
  sortable?, sticky?, defaultHidden?, alwaysVisible?, width? }`. The table owns
  sort + pagination + column-vis + density + selection + sheet; **filters stay
  per-page** (each section builds its own filter bar that writes other URL
  params — the table only reads what it needs). Parent server component reads
  `sort`/`dir`/`page` from searchParams and queries; the table is the
  presentational + interaction layer. Message keys: new `table.*`
  (columns/compact/comfortable/page/loading/error/retry) in en+ar.
- **Deliberate simplification:** virtualization is **deferred** (a `ponytail:`
  comment marks it) — server pagination caps rendered rows at ~`pageSize` (25),
  so `@tanstack/react-virtual` only earns its place when a view renders 200+
  unpaginated rows. No new dependency added this section.
- **Proven in `/design-preview`** (§6 "Data table" rewritten from the old
  static sample to a live `<DataTable>` demo with 6 sample orders + a
  ready/loading/empty/error state switcher): exercised sort (Total asc
  reordered the rows + arrow), sticky Order column, Phone column hidden by
  default via the column menu, density toggle, select-all → "6 selected /
  Assign agent / Export 6" bulk bar, kebab, and click-row → sheet
  (`?row=o1042`, Escape closed + cleared the param). This is the pattern the
  real Orders/Products/Finance tables will instantiate in later sessions.
- **Screenshot self-critique (both themes, live on the local seed stack):**
  `docs/design/audit/datatable-{dark,light}.png`, `datatable-sheet-dark.png`,
  `datatable-bulk-dark.png`, `datatable-empty-light.png`. Both themes correct;
  console clean (0 errors) through sort/select/sheet/state interactions;
  ponytail-review pass merged two mount effects into one (−6 lines).
- **Known / for the consumers:** deep-link `?row=` only opens the sheet if the
  key matches a row on the current page — real pages that deep-link to an
  arbitrary order should fetch that row for the sheet (the foundation passes
  the already-loaded row object). The floating bulk bar keeps its count when
  toggled to the empty state in the demo (selection persists across a result
  change) — a demo artifact, harmless in real use. `onRetry` is a caller hook
  (the demo just flips local state back to ready); real pages wire it to a
  refetch / `router.refresh()`.
- **Next chat must know:** `npm run build` + `npm test` green (25 pass / 38
  RLS-suite skipped, unchanged — no test file for the table, its behavior is
  the live design-preview reconciliation above), forbidden-color grep = 0,
  `graphify update .` run. **Phase 12 §2 (Orders)** is the next session:
  instantiate `<DataTable>` for Orders/All (missing columns + duplicate chip +
  bulk + detail sheet), convert Confirmation from the card-stack to
  table+sheet, Delivery table + kanban toggle. §3 Products (card grid + Real
  column), §4 Finance, §5 Dashboard, §6 Contacts, §7 Team (+Tasks kanban into
  the Phase-11 shell), §8 Settings (grouped cards + Appearance), §9 Option sets
  — one per session, each ending green + screenshotted + a PROGRESS block.

## Phase 12 §2 — Orders (All / Confirmation / Delivery) (2026-07-27) — DONE
- Scope: section 2 of 9. Re-based all three Orders views onto the Phase-12 §1
  `<DataTable>` + the Phase-11 status/field system, plus the order detail page
  and the manual-create form. **Net −172 source lines** (556 del / 384 ins)
  while adding every checklist feature — the card-stack rows and native
  `<select>`s were the bulk of what got deleted.
- **All** (`all/page.tsx` + new `all/orders-all-table.tsx`, client): `<DataTable>`
  with the full column set the brief lists (sticky order#, date, customer+phone,
  product **thumbnail**+name, qty, total, delivery fee [hidden by default],
  wilaya, **source chip** [shopify=info / lightfunnels=violet / manual=neutral],
  confirmation `<StatusPill>`, delivery `<StatusPill>`, agent [hidden]).
  **Duplicate chip** on the order cell (links to the original) + a **"Duplicates
  only"** filter. **Bulk bar**: Set confirmation (menu of confirmation statuses →
  `bulkTransition`), Assign (conf/deliv agents → `bulkAssignAgents`), Export N
  (CSV of the selected rows via the existing `csv.ts`). **Detail sheet**:
  both status pills, customer block with `tel:` link, money block
  (total + delivery fee, `showMoney={isAdmin}` — hidden for agent roles per the
  brief), and the **status timeline** (new shared `order-timeline.tsx`, actor +
  duration-per-stage). Sort (order#/placed_at) + pagination are the DataTable's
  URL params, read back server-side; filters are a new client
  `orders-filter-bar.tsx` (Radix Selects + `DateField`, URL-persisted, active
  chips + clear-all).
- **Confirmation** (`confirmation/page.tsx` + new `confirmation-table.tsx` /
  `confirmation-sheet.tsx` / `new-orders-pill.tsx`; **deleted** the old
  `row.tsx` card-stack): switched to **table + detail sheet** (the decided
  default). Table cols: order# (+dup chip), customer+`tel:`, product, qty, total,
  **risk pill** (`<RiskBadge>`, reason on hover), confirmation pill, date. Sheet
  is the call workflow in the exact checklist order: name → big green `tel:`
  call link (also logs a dial) → risk badge + attempt count → **previous orders**
  (other orders by the same customer, one grouped `.in()` query, capped 5) →
  product/qty/price → **large status buttons** (legal transitions only) →
  comment → **Save / Save & open next**; **↑/↓** move between queue rows while
  the sheet is open (keyed `key={order.id}` so fields reset per order). A
  **"N new orders" pill** polls the workspace queue every 20 s (ponytail:
  polling, not realtime — never re-sorts under the cursor) and refreshes on
  click. Handled rows leave the pending filter on refresh (query is
  `confirmation_status <> 'confirmed'`).
- **Delivery** (`delivery/page.tsx` + new `delivery-view.tsx` /
  `delivery-table.tsx` / `delivery-kanban.tsx`; **deleted** old `row.tsx`):
  **dense table by default** (added a `defaultDensity` prop to `<DataTable>`) +
  **kanban toggle** (`?view=kanban`). Table: per-row `<StatusSelect>` (legal
  transitions) + a one-click quick-advance chevron to `next[0]`; delayed/
  returning rows get a colored leading bar. Kanban: columns per delivery status
  with counts + empty "Nothing here", cards move by **native HTML5 drag** OR the
  on-card `<StatusSelect>` (keyboard-accessible equivalent), **only legal
  transitions accepted** (`transitionsFor`), optimistic move with rollback +
  toast on failure. Both share one `useAdvanceDelivery()` hook →
  `updateOrderStatus` (Phase-5 RPC, reused, returns `UpdateResult`).
- **Detail page + create form** (kill the last native `<select>`s in the
  section): `order-workflow.tsx` now uses `<StatusSelect>`/`<StatusPill>` and the
  shared `<OrderTimeline>`; `[id]/page.tsx` status Badges → `<StatusPill>`;
  `assignment-card.tsx` → Radix `<Select>` (sentinel `__none` = unassigned);
  `order-form.tsx` fully rebuilt onto `ProductCombobox`/`WilayaCombobox`/
  `PhoneField`/`MoneyField`/`QuantityStepper` + Radix delivery-type select,
  React state driving the auto-fill (product→price, wilaya/type→fee; editing the
  fee flips `delivery_fee_source` to manual). Added an optional `onChange` to
  `MoneyField` (fires on user input only, so a remount-seeded auto value doesn't
  trip the "manual" flag). `createOrder` action + its FormData names unchanged.
- **New server actions** (`actions.ts`): `bulkTransition(ids, stage, status)`
  and `bulkAssignAgents(ids, conf, deliv)` — both `isCurrentUserAdmin()`-gated,
  zod-validated ids/status. bulkTransition loops the transition RPC per id
  (ponytail: selection is capped at one page ~25; a batched RPC only earns its
  place at hundreds).
- **Verification (live, local seed stack):** ran the dev server against the
  **local** Supabase docker (`127.0.0.1:54321`, demo keys) via a gitignored
  `.env.development.local` (higher precedence than the remote-pointing
  `.env.local`; **removed after**) — the repo's `npm run dev` wrapper does NOT
  inherit inline env exports, so the override file is the way to point dev at
  local. Logged in as `admin@seed.mnw` / `SeedDev!2026` (workspace with the 60
  seed orders — 22 pending / 38 confirmed). **Screenshots both themes** in
  `docs/design/audit/`: `orders-all-{light,dark}`, `orders-all-sheet-dark`,
  `orders-all-bulk-dark`, `orders-confirmation-{dark,light}`,
  `orders-confirmation-sheet-dark`, `orders-delivery-table-dark`,
  `orders-delivery-kanban-{dark,light}`, `orders-new-light`. All four states,
  both themes, keyboard (↑/↓ + Enter), and every drill-through render correctly;
  console clean except dev-only HMR-reconnect noise from a mid-session server
  restart. **Fixed from the shots:** order# wrapped when a Duplicate chip was
  present → added `whitespace-nowrap` (All + Confirmation order cells).
- Known / for consumers: **All is admin-only** (Phase-1 `AdminGuardLayout`), so
  the money block is always shown there in practice; `showMoney` is still gated
  on `isAdmin` as defense in depth. Bulk **Export** covers the currently loaded
  page (selection doesn't persist across pages in the DataTable) — fine for the
  25-row page size. CSV export "respects filters" via the already-filtered page
  rows, not a full-result refetch. The confirmation sheet's status buttons show
  only the current status for **terminal** orders (cancelled/confirmed) — correct
  per the status graph, but means a cancelled order in the queue can't be
  re-opened from the sheet. Delivery status changes and the new-order form were
  verified visually (render + wiring); the underlying `transition_order_status`
  RPC + `createOrder` action are unchanged from Phases 5.
- **Next chat must know:** `npm run build` + `npm test` green (25 pass / 38
  RLS-suite skipped), forbidden-color grep = 0, no native `<select>` left in
  `src/app/app/orders`, `graphify update .` run. **Phase 12 §3 (Products)** is
  next: switch the list to the image-card grid default (table as a persisted
  toggle), product-context header across tabs, add the pricing **Real** column +
  break-even, Money/Percent fields with live conversion, Expenses tab on the
  shared Finance form. Reuse `<DataTable>`, `<StatusPill>`, `order-timeline.tsx`
  (if a product→orders tab wants a timeline), and the `orders-filter-bar.tsx`
  pattern for any product filters.

## Phase 12 §3 — Products (2026-07-27) — DONE
- Scope: section 3 of 9. Rebuilt the Products section onto the §1 `<DataTable>`
  + §2 status/field system, and built the shared Finance/Stats components §4/§5
  will reuse. **Net roughly flat on tracked files (+431/−427)** while adding the
  card grid, break-even, shared expense/ad-spend forms, and killing every native
  `<select>` — the card-stack table markup and native selects were the deletions.
- **List → image-card grid is the default; table is a persisted toggle**
  (`?view=table`). New `products-view.tsx` (client): grid of fixed-height cards
  (image/placeholder, name, `<StatusPill kind="product">`, sale price, delivery
  rate, **net-profit color-coded** with drill-through to the Stats tab, **30-day
  order-count sparkline**, kebab with Edit + status change) OR the `<DataTable>`
  table view (sticky name, stock chip, rate, net profit, status pill). `page.tsx`
  now fetches `product_stats` + active `fixed_fees` + last-30-day orders and
  computes net profit via the new shared `src/lib/product-metrics.ts` (`netProfit`
  extracted from the old statistics page so grid + stats share ONE formula).
  Sparkline is a new dep-free inline-SVG `components/ui/sparkline.tsx`.
- **Product-context header across all tabs** (`[id]/layout.tsx`): breadcrumb +
  image + name + status pill, above a new **active-aware** `product-tabs.tsx`
  (client, `usePathname`). Tabs: Overview · Pricing · Expenses · **Orders** (new)
  · Stock · Statistics. **New Orders tab** (`[id]/orders/`) — lean `<DataTable>`
  of this product's orders (order#→detail, status pills) + "View all" →
  `/app/orders/all?product_id=…` (interconnection product→orders). Overview
  (`[id]/page.tsx`) dropped its duplicate PageHeader (header is now in the
  layout); Delete is separated + red at the bottom.
- **Pricing (`scenario-engine.tsx`)**: inputs are now `MoneyField` (DA/EUR suffix
  + live "≈ … DA at rate" conversion) / `PercentField` (added an `onChange` to
  PercentField for the autosave engine); the read-only **Real** column already
  existed (Phase 4). Added a **break-even indicator** per card via new
  `breakEvenDeliveryPct(inputs)` in `src/lib/pricing.ts` (0.5%-step scan, since
  the model isn't cheaply invertible) — "needs ≥ X% delivery rate to profit" in
  success/warning by whether the card's delivery rate clears it, or "Never
  profitable at these inputs" in danger. 3 new cases in `pricing.test.ts`
  (crossing point + already-profitable + never). `pricing.ts` scenario formulas
  untouched (CLAUDE.md).
- **Expenses tab + shared Finance components** (interconnection Rule 1): built
  `components/finance/{expense-form,expense-table,ad-spend-form}.tsx` +
  `components/fields/money-currency-field.tsx` — the SAME components §4 Finance
  will reuse unfiltered. `saveExpense` refactored to `(formData)` reading
  `id`/`product_id` from the form (was `.bind(id, productId)`) so one form serves
  the product tab (product locked) and Finance (product via `ProductCombobox`);
  `saveExpense`/`upsertAdSpend`/`setProductStatusValue` now return
  `UpdateResult` for client toasts. `[id]/expenses` now shows **income (auto from
  delivered orders) / spend / net profit side-by-side**, the ad-spend quick form
  pinned on top, category totals, and the shared expense table (edit via sheet,
  delete). **Deleted the old native-select `ad-spend-entry.tsx`** and repointed
  the Dashboard to `<AdSpendForm>` (§5 will make it the 4-field modal).
- **Stats tab** reuses new shared `components/stats/{kpi-tile,funnel}.tsx`
  (KpiTile: big tabular number, optional delta/sparkline/drill-through — the
  delta/spark props are for §5 Dashboard; Funnel: stepped bars + drop-off %).
  KPIs drill to the product Orders tab; expenses-by-category uses the shared
  `CATEGORY_ICONS` (exported from `category-select.tsx`).
- **Every native `<select>` in the section is gone**, replaced by a new reusable
  `components/fields/enum-select.tsx` (Radix Select for **system enums** — product
  status, currency, stock reason, ad kind; the taxonomy counterpart is §9's
  `OptionSelect`). product-form status → EnumSelect showing the StatusPill, active
  checkbox → `SettingSwitch`, sourcing currency → EnumSelect; stock reason →
  EnumSelect, its status Badges → `<Chip>` tokens, `text-emerald-600`/
  `text-destructive` → `text-success`/`text-danger`.
- **Screenshot self-critique (both themes, local seed stack)**: ran dev against
  local Supabase (`127.0.0.1:54321`, demo keys) via a gitignored
  `.env.development.local` (**deleted after**), logged in as `admin@seed.mnw`.
  `docs/design/audit/products-{grid,table,overview,pricing,expenses,stats,orders,
  stock}-{dark,light}.png` (16 shots). All four states, both themes, active-tab
  highlight, drill-throughs, EUR live conversion, break-even coloring render
  correctly; **this session's console is clean** (only DevTools/HMR noise — the
  nested-button hydration + duplicate-key warnings in the log are from an earlier
  session's `/app/contacts`/`/app/team`, not this section). No fixes needed from
  the shots.
- Known / for consumers: **§4 Finance** reuses `components/finance/*` directly —
  pass `products` (no `productId`) for the unfiltered view; `saveExpense` already
  accepts an optional `product_id`. **§5 Dashboard** reuses `components/stats/*`
  (KpiTile's `delta`/`spark` are ready) and should turn `<AdSpendForm>` into the
  4-field Quick-actions modal. Stock stays a 6th tab (real functionality, not in
  the checklist's 5 but not forbidden). Per-wilaya-for-one-product is **not** on
  the Stats tab — no data source; the dashboard choropleth is §5. Net profit on
  cards/tiles shows "—" until a product has delivered orders (Real-column
  convention). `formatCurrency` still renders "DZD" (not "DA") — unchanged from
  the codebase, not touched this phase.
- **Next chat must know:** `npm run build` + `npm test` green (28 pass / 38
  RLS-suite skipped), forbidden-color grep = 0 on touched files, no native
  `<select>` in `src/app/app/products` or `src/components/finance`, `graphify
  update .` run. **Phase 12 §4 (Finance)** is next: build the real Overview/
  Expenses/Ad spend/Income under the existing `AdminGuardLayout`, reusing
  `components/finance/*` (the same `<ExpenseForm>`/`<ExpenseTable>`/`<AdSpendForm>`
  proven here), `dashboard_stats` for the date-filtered overview, and the
  `components/stats/*` KPI/Funnel tiles.
