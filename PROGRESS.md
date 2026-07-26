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
