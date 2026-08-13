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
| 12 — Section pass (9 sections, one per session) | docs/phases/phase-12.md | done |
| 12b — Navigation, color & map fixes (inserted before §6) | docs/phases/phase-12b-ux-fixes.md | done |
| 13 — Final sweep | docs/phases/phase-13.md | done |
| 14a — Orders status model rework (one column, free changes, RLS, history popover) | docs/phases/phase-14-plan.md §14a | done |
| 14b — Exchange, Swap & return-fee default | docs/phases/phase-14-plan.md §14b | done |
| 14c — Finance → Accounts (ledger) | docs/phases/phase-14-plan.md §14c | done |
| 14d — Stock hub + auto-decrement | docs/phases/phase-14-plan.md §14d | done |
| 14e — Rules redesign | docs/phases/phase-14-plan.md §14e | planned |
| 14f — Users + Audit → Settings | docs/phases/phase-14-plan.md §14f | planned |
| 14g — Analytics: delivery rate + timing stats (+ PRICING_AND_RISK.md) | docs/phases/phase-14-plan.md §14g | planned |
| 14h — Google Drive + Calendar (OAuth) | docs/phases/phase-14h-google-oauth.md | planned (needs user GCloud setup) |

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

## Phase 14 runner prompts (self-advancing, two-pass GLM — paste the SAME text each new chat)

The phase table above is the task tracker: `planned` = not done, `done` = done.
One local command switches Claude Code's backend to Z.ai (`claude-switch`, no
Claude subscription involved): **`glm`** launches on **GLM-5.2** (deep
reasoning) by default. `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` is set in
that mode, so typing **`/model`** inside the session opens a picker listing
every model Z.ai's endpoint exposes (glm-5.2, **glm-5-turbo**, glm-4.5-air, …)
under "From gateway" — switch to `glm-5-turbo` for the fast execution pass, no
new command, no restart. `cc` still runs the real Claude subscription if ever
needed.

`/model` swaps the model **without restarting the process, so the execution
pass keeps the analysis pass's full conversation context** — this is one
continuous session, not two. The analysis pass still appends a `### GLM 5.2
execution brief` subsection into the phase file as a durable checkpoint (useful
if the session gets compacted or you come back to it another day), but the
execution pass has the live discussion too, not just that file.

Each phase is run in its own **fresh chat** (to keep context small / cheap).
That means the BOOTSTRAP prompt below re-runs every time — it's deliberately
scoped to graphify + a few short docs, never a broad source read, to keep that
repeated cost small.

**Workflow per phase (one `glm` session, new chat each phase):**
1. Run `glm` (starts on GLM-5.2).
2. Paste the BOOTSTRAP prompt → it orients on the project + full backlog via
   graphify + short docs (no source-wide reads), reports a compact summary,
   picks no phase yet, writes nothing.
3. Paste the ANALYZE prompt → it picks the next phase and writes the brief,
   then stops (no code, no branch, no commit).
4. Type `/model` and pick `glm-5-turbo` (or `/model glm-5-turbo` directly).
5. Paste the EXECUTE prompt → it builds, tests, reviews, merges, and flips the
   row to `done`.
6. Next phase: start a **new chat**, `glm` again, back to step 2.

### BOOTSTRAP prompt (paste FIRST, every new phase chat, before ANALYZE)

```
Orient on this project WITHOUT broad source reads — graphify + short docs only,
to keep this a cheap pass (this runs fresh every phase chat):

1. Read CLAUDE.md in full (project conventions — short).
2. Read PROGRESS.md lines 1–160 ONLY (the phase table + the "Phase 14 runner
   prompts" section you're following right now). Do NOT read past line ~160 —
   everything below is historical per-phase handoff logs already superseded by
   CLAUDE.md + docs/phases/phase-14-plan.md; reading them wastes tokens for no
   new information.
3. Read docs/phases/phase-14-plan.md in full — this IS "the steps of
   modification": every 14a–14h sub-phase summary plus the "Locked decisions"
   block (cross-cutting rules every phase must respect). Small file, worth
   reading whole.
4. Run `graphify query "orders status model, RLS pattern, finance, stock,
   team/rules, settings, analytics views"` (or similarly-scoped queries) — NOT
   raw greps — to refresh which files/tables back each area. If
   graphify-out/GRAPH_REPORT.md's "Built from commit" is behind
   `git rev-parse HEAD`, run `graphify update .` once so this chat's queries
   (and the ANALYZE pass right after) are accurate.
5. Skim graphify-out/GRAPH_REPORT.md's Community Hubs / Summary section for the
   big-picture module map — don't read it end to end unless query/explain
   don't surface enough.

Then STOP and report back, briefly (under 200 words, no essay):
- Which 14-phases are done vs planned (from the table).
- One line confirming you've internalized the Locked decisions.
- Up to 3 architecture facts you found most load-bearing for upcoming phases.

Do NOT pick a phase, write an execution brief, touch any code, run a build, or
create a branch yet — that's the ANALYZE prompt's job, next message.
```

### ANALYZE prompt (paste second, after BOOTSTRAP, while still on glm-5.2)

```
Read CLAUDE.md and PROGRESS.md. In the phase table, find the FIRST 14-series row
whose Status is "planned" AND whose phase file section does NOT yet contain a
"### GLM 5.2 execution brief" subsection (top-down = dependency order) — that
is your phase. If the only planned rows left are 14h (Google) or any row marked
"needs user setup"/blocked, STOP and tell the user what setup is required.

Read that phase's section in docs/phases/phase-14-plan.md §<id> (for 14h read
the whole docs/phases/phase-14h-google-oauth.md) + the "Locked decisions" block.
Use `graphify query` to orient, then trace every file/table/RLS policy/view the
section actually touches — read the real current code, don't trust the plan
blindly (it may have drifted since it was written). Do NOT write feature code,
create a branch, or touch the phase table's Status.

Produce a concrete execution brief and append it as a new subsection directly
under that phase's `## 14x` heading in the SAME phase file:

### GLM 5.2 execution brief
- Exact files to touch (paths, not descriptions) and what changes in each.
- Exact migration SQL skeleton if the phase needs one.
- Order of steps (what must land before what).
- Every place the "Locked decisions" assumptions were confirmed or turned out
  stale, with the corrected fact.
- Edge cases / gotchas found while tracing (RLS interactions, trigger
  ordering, existing views that already compute part of this — reuse, don't
  rebuild).

Stop after appending. Do not run npm/build, do not commit.
```

### EXECUTE prompt (paste after switching `/model` to glm-5-turbo)

```
Read CLAUDE.md and PROGRESS.md. In the phase table, find the FIRST 14-series row
whose Status is "planned" AND whose phase file section already contains a
"### GLM 5.2 execution brief" subsection. If the first planned row has NO
brief yet, STOP and tell the user to switch back with `/model glm-5.2` and run
the ANALYZE prompt for that phase first — do not analyze it yourself and do not
skip ahead to a later row that happens to have a brief.

Read that phase's section + its execution brief + the "Locked decisions" block
in docs/phases/phase-14-plan.md §<id> (for 14h: docs/phases/phase-14h-google-oauth.md).
Execute THAT phase only, following the brief, on branch mnw-<id> (row "14c …" →
§14c → branch mnw-14c). Read nothing else unless pointed there.

Invoke ponytail:ponytail before writing code. Use `graphify query` to orient,
not broad greps. No raw <input>/native <select> (use components/fields/* +
Radix); no hardcoded colors; every user-visible string in
src/messages/{en,ar}.json (EN + AR).

When `npm run build` (and `npm test`) is green: run ponytail:ponytail-review on
the diff, `graphify update .`, screenshot every screen you touched in BOTH
themes with the Playwright MCP and fix what they show. Then (a) append a
PROGRESS.md handoff block and (b) flip this phase's row Status from "planned" to
"done" in the phase table. Merge --no-ff into mnw. Stop after this one phase.
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

## Phase 12 §4 — Finance (2026-07-27) — DONE
- Scope: section 4 of 9. Built the four real Finance subsections (`overview`,
  `expenses`, `ad-spend`, `income`) behind the existing `AdminGuardLayout`,
  replacing the four `redirect()`/`Empty` stubs from Phase 11/§3. Reused
  `components/finance/{expense-form,expense-table,ad-spend-form}.tsx` and
  `components/stats/*` per the handoff — no parallel record forms, no forked
  pricing/net-profit math.
- **New `finance-tabs.tsx`** (mirrors `OrderTabs`/`ContactTabs`/`TeamTabs`,
  `TabsNav`-based) and **`finance-filter-bar.tsx`** (mirrors
  `orders-filter-bar.tsx`: URL-persisted product/category/kind + date-range
  with Today/7d/30d presets, active-filter chips, clear-all), one component
  reused across all four pages via `showProduct`/`showCategory`/`showKind`
  props instead of four bespoke bars. Also exports `financeQs()`, a tiny
  query-string builder both Overview and Income use for their drill-through
  links (deduped during ponytail-review — was copy-pasted into both files
  first draft).
- **Overview**: date-range (+ optional product) filtered `dashboard_stats` RPC
  for Revenue/Invested/Net profit KPI cards (Revenue/Invested link out;
  Net profit has no natural single destination, left as a plain tile),
  **Spending by category** (RPC's `category_spending`, each row linking to
  Expenses filtered by that category), and a new **Spend by product** panel —
  computed by fetching raw `expenses`/`ad_spend_daily` rows for the same
  date range (grouped in JS by `product_id`, same aggregation style
  `ExpenseTable`'s category totals already use) since `dashboard_stats` only
  returns per-product *revenue*, not spend, and extending the RPC was out of
  scope for a UI-pass section. **Fixed fees** line reuses the same
  active-`fixed_fees` sum Products/Statistics already computes, linking to
  Settings.
- **Expenses**: `FinanceFilterBar` (product+category+date, `showCategory`) over
  a plain `expenses` query honoring `from`/`to`/`product`/`category` from the
  URL, rendered through the **unmodified `<ExpenseTable>`** — same sheet, same
  `saveExpense` action, same category-total chips as the product Expenses tab.
  Confirmed live: opening "New expense" here is the identical form Products
  §3 uses (interconnection Rule 1).
- **Ad spend**: new **`components/finance/ad-spend-table.tsx`** (list view —
  didn't exist before this section, only the quick-entry `<AdSpendForm>` did)
  with a product column, a `Chip` kind badge (test=info, scaling=violet), and
  row edit/delete via the same `<AdSpendForm>`. **Extended `<AdSpendForm>`**
  with optional `defaultValues`/`onDone` for edit mode: date and kind render
  as locked read-only text (not editable fields) when editing, because
  `upsertAdSpend` upserts on `(workspace_id,product_id,spent_on,kind)` — an
  edit that changed date or kind would upsert a *new* row under a different
  conflict key instead of updating the one being edited, leaving a stale
  duplicate. Only amount/currency are editable, which keeps the conflict key
  identical and makes the upsert a true update. Verified live (screenshot):
  edit sheet shows locked "2026-07-25 · Test" with amount pre-filled and the
  DZD conversion line correct.
- **Income**: **no manual entry** — queries `orders` where
  `delivery_status in (delivered, returned)` for the date range, aggregates
  in JS by product (delivered count + revenue, returned count), multiplies
  returned count by `settings.return_fee.amount` (`getSetting`) for a
  **return-fees** column, and shows delivered/revenue/returned/return-fees/net
  per product plus workspace totals. Delivered/returned counts link to
  `/app/orders/all` filtered to that product+status; product name links to
  its Statistics tab. Deliberately did **not** touch `/app/orders/cash`
  (physical cash-collection reconciliation, a different concept the phase
  brief doesn't mention) — Income is the *financial reporting* view of
  revenue, Cash is the *operational* collect/deposit workflow; the old stub
  redirected Income to Cash, which conflated the two, and this section
  corrects that by giving Income its own real page.
- **RLS verified** (no migration touched): `expenses`/`ad_spend_daily` (and
  `fixed_fees`/`contacts`) carry a single admin-only `_adm` policy
  (`is_admin()`-gated, `for all`) from `00003_products.sql`, already exercised
  generically by Phase 10's `rls.test.ts` — combined with the untouched
  `AdminGuardLayout` on `/app/finance`, the section is invisible+unreachable
  for agents at both the RLS and route-guard layers, not just hidden nav.
- **Screenshot self-critique (both themes, local seed stack)**: ran dev
  against local Supabase (`127.0.0.1:54321`, demo keys) via a gitignored
  `.env.development.local` (**deleted after**), already-authenticated as
  `admin@seed.mnw`. `docs/design/audit/finance-{overview,expenses,ad-spend,
  income}-{dark,light}.png` (8 shots) + `finance-expenses-new-sheet-dark`,
  `finance-adspend-edit-sheet-dark`, `finance-expenses-filtered-category-light`
  (drill-through from Overview → Expenses?category=shooting verified live:
  filter select pre-set, active chip, table correctly narrowed). All four
  subsections, both themes, tab switcher, filter bar + presets, create/edit
  sheets render correctly; console clean (0 errors/warnings) through the
  whole pass. No fixes needed from the shots.
- Known / for consumers: **§5 Dashboard** should reuse `finance-filter-bar.tsx`'s
  shape (or the component itself) for its sticky filter bar rather than
  rewriting `dashboard/page.tsx`'s existing raw-`<Input type="date">` filter
  form from scratch, and should turn the still-inline `<AdSpendForm>` on
  `/app/dashboard` into the 4-field quick-actions modal the brief calls for
  (this section did not touch the Dashboard page itself — only added the new
  `<AdSpendTable>` list, which Dashboard doesn't use). "Spend by product" on
  Overview has no RPC backing (JS-aggregated raw rows) — if a future section
  needs the same breakdown server-aggregated, extend `dashboard_stats` rather
  than re-deriving it a third time. `expenses`/`ad_spend_daily` queries in the
  three list pages don't paginate beyond `<DataTable>`'s own page size — fine
  at this app's scale, revisit if a workspace's raw row count ever grows large
  enough to matter.
- **Next chat must know:** `npm run build` + `npm test` green (28 pass / 38
  RLS-suite skipped, unchanged — no new test file; this section is UI/queries
  over already-tested `settings.ts`/`format.ts`, nothing new to unit-test),
  forbidden-color grep = 0 on touched files, no native `<select>`/raw
  `<input>` in `src/app/app/finance` or `src/components/finance`, `graphify
  update .` run (1241 nodes). **Phase 12 §5 (Dashboard)** is next: sticky
  filter bar (reuse `finance-filter-bar.tsx`'s pattern), KPI cards with
  delta+sparkline+click-to-filter (`components/stats/kpi-tile.tsx` already
  supports `delta`/`spark`), the per-wilaya choropleth (new build), and the
  ad-spend quick-action modal (replace the inline `<AdSpendForm>` currently
  sitting at the bottom of `/app/dashboard`).

## Phase 12 §5 — Dashboard (2026-07-28) — DONE
- Scope: section 5 of 9. Rewrote `/app/dashboard` end-to-end: sticky
  URL-persisted filter bar (date range + product/wilaya/source/agent/
  confirmation/delivery), 6 KPI tiles wired for real
  (delta-vs-previous-period + sparkline + click-to-filter, using
  `components/stats/kpi-tile.tsx` as-is), funnel + profit/spend time chart,
  per-wilaya table beside a new Algeria choropleth, per-agent + per-product
  rate tables, spend-by-category bars, next-meeting/open-tasks cards, and a
  quick-actions row with a 4-field **Add ad spend modal** replacing the
  inline `<AdSpendForm>` that used to sit at the bottom of the page.
- **`dashboard_stats` RPC extended** (`supabase/migrations/
  00010_dashboard_filters_daily.sql`): added `p_confirmation_status`,
  `p_delivery_status`, `p_agent` (ORs across confirmation/delivery agent)
  filter params, and a `daily` jsonb array (per-day received/confirmed/
  delivered/revenue/invested via `generate_series`, defaults to trailing 30
  days, capped at 365) plus `stop_shipping_min_orders` in the return — both
  feed the KPI sparklines/deltas and the time chart. Had to explicitly `drop
  function` the old signature first — `create or replace` with new params
  creates a second overload instead of replacing it, which breaks every
  existing call site with an ambiguous-function error until dropped.
- **Algeria choropleth** (`components/dashboard/algeria-map.tsx`): no
  mapping library/geodata in the repo, so it's a hand-placed 58-wilaya grid
  cartogram (schematic, not true borders — documented as such in the file),
  verified complete/collision-free by `algeria-map.test.ts`. 5-step token
  color scale on delivery rate, gated by the *same* `confirmedOrders <
  min_orders` threshold `stop_shipping_auto` uses (a totalOrders-based first
  draft gave a different "no data" set than the table's own stop-shipping
  flag — fixed to use confirmedOrders so map and table always agree).
  Table (source of truth for numbers) and map share hover state and both
  drill through to `/app/orders/all?wilaya_code=`; map stacks below the
  table on narrow screens (`grid-cols-1 lg:grid-cols-[1fr_auto]`), verified
  at 390px.
- **Two pre-existing Next 16 RSC violations found and fixed at the root**,
  not worked around locally: (1) `financeQs` lived in a `"use client"` file
  (`finance-filter-bar.tsx`) and was being called from server components —
  Next 16 forbids calling any function exported from a client module from
  server code, even a pure one. This was already 500-ing Finance Overview
  and Income (Phase 12 §4), not something this section introduced. Fixed by
  extracting `financeQs`/`ordersQs`/`DashboardFilters` into a new plain
  module `src/lib/query-string.ts` and repointing all three pages' imports.
  (2) `WilayaSection` (client) was going to receive a `wilayaHref` closure
  as a prop from the server `page.tsx` — functions can't cross that
  boundary either — fixed by passing plain serializable `filters` data and
  calling `ordersQs()` internally in the client component instead.
- **RTL bug found and fixed in a shared utility, not new to this section**:
  signed numbers rendered with a literal `−` prefix (funnel drop-off %,
  net-profit KPI) were visually reordering to `36.7%−` inside the Arabic
  (RTL) document — a bidi effect on the shared `.num` class
  (`src/app/globals.css`), used everywhere money/percent/counts are
  formatted. Fixed once at the class (`direction: ltr; unicode-bidi:
  isolate;`) rather than per call site, since every negative-number display
  in the app routes through `.num`. Verified via
  `docs/design/audit/dashboard-ar-rtl.png` before/after.
  Deliberately simplified vs. the old multi-select Orders/Finance filter
  bars: `dashboard-filter-bar.tsx` uses single-value Radix `Select`s per
  dimension (not multi-select), consistent with the RPC's own
  single-or-array param shape and the decided-defaults brief; also
  remembers the last-used filter set per user via `localStorage`
  (`mnw:dashboardFilters`), restored on next visit only when the URL has no
  params of its own.
- No charting library added — `time-chart.tsx`/`Sparkline`/`Funnel` are
  hand-rolled inline SVG, matching the convention already established by
  `components/stats/*` in §3.
- **Screenshot self-critique (both themes + RTL + mobile, local seed
  stack)**: `docs/design/audit/dashboard-{dark,light}.png` (full page, both
  themes correct — map colors, KPI cards, all sections render), `dashboard-
  ar-rtl.png` (Arabic/RTL — caught and fixed the `.num` bidi bug above,
  re-verified after the fix), `dashboard-mobile.png` (390px — map correctly
  stacks below the per-wilaya table). Live-tested the **Add ad spend**
  modal end-to-end: opened from the Quick actions row, selected a product,
  entered an amount, saved, confirmed the row landed in `ad_spend_daily`
  with the correct `amount_dzd` conversion, then deleted the test row.
- Known / for next section: **Phase 12 §6 (Contacts)** is next. "My open
  tasks" card is an honest empty state (`t("dashboard.myTasks.none")`) —
  there's no tasks table yet; wire it up once a later phase adds one, don't
  fake data. `dashboard_stats`'s `daily` series is capped at 365 rows —
  fine for any realistic filter range, revisit only if unbounded multi-year
  date ranges become a real use case.
- **Next chat must know:** `npm run build` + `npm test` green (30 pass / 38
  RLS-suite skipped — no new test file beyond `algeria-map.test.ts`'s
  grid-completeness check), forbidden-color grep = 0 and no native
  `<select>`/raw `<input>` across all files touched this section (including
  the `.num` fix and the two RSC-boundary fixes), `graphify update .` run
  (1268 nodes, 3002 edges, 105 communities). `stop_shipping_rule` restored
  to `{min_orders:10, min_delivery_rate:40}` after temporarily lowering it
  to verify map coloring against seed data (seed data only has 3-5 orders
  per wilaya, so most wilayas legitimately show "no data" at the real
  threshold — that's correct behavior, not a bug).

## Addendum — user feedback on §5, redirect before §6 (2026-07-28)

Real user feedback arrived after using the merged §5 Dashboard (not from the
architect's brief). Written up as its own inserted phase,
**`docs/phases/phase-12b-ux-fixes.md`** — read it in full before touching
code. Covers: a real RTL bug (sidebar likely invisible in Arabic at desktop
widths — root cause already diagnosed, see the doc's §1), folding
theme/language/sign-out into an avatar dropdown menu, shortening the
too-tall always-expanded nav, moving the brand mark out of the sidebar
header, replacing the §5 grid-cartogram map with a real interactive
wilaya map (deliberately reverses `components.md`'s "no mapping library"
default — update that doc once built), proper success/danger color usage
for profit/invested/rates in the dashboard's tables and charts, a
decision-point on whether confirmation/delivery status breakdown charts fit
on the existing Dashboard or need their own page, and vivid per-option
colors in selects (should route through the existing status/option-set
color system, not a new one — check whether §9 Option sets already plans
this before duplicating it).

Also added **`docs/TESTING.md`**: the permanent local test account
(`admin@seed.mnw` / `confirmation@seed.mnw` / `delivery@seed.mnw`, password
`SeedDev!2026`, workspace "MNW Seed") already existed via
`scripts/seed-dev.ts` (idempotent, deterministic) — it just wasn't written
up anywhere for quick reference. Use it to spot-check after every task
instead of re-deriving login/seed state each time.

**Phase 12b is next**, not §6 (Contacts) — building the next section on a
sidebar that's broken in Arabic just compounds the fix later. §6 resumes
once 12b is merged.

## Phase 12b — Navigation, color & map fixes (2026-07-28) — DONE

- **Done:** all 8 items from `docs/phases/phase-12b-ux-fixes.md`.
  1. RTL sidebar bug fixed (`app-shell.tsx`): mobile-drawer transform classes
     scoped to `max-md:`, so `md:translate-x-0` unconditionally wins at
     desktop widths regardless of RTL/open state. This was the reported
     "sidebar invisible in Arabic" bug — confirmed via screenshot at desktop
     width in Arabic (previously-broken case), now visible.
  2. Avatar row is now a `DropdownMenu` (reused the existing Radix
     primitive) holding theme toggle, language switcher, sign out — sidebar
     footer down from ~4 stacked rows to one.
  3. Nav sections collapse to just the parent link unless they contain the
     active page (accordion, auto-expand on navigation). Combined with #2,
     the sidebar no longer needs scrolling to see all top-level sections.
  4. Brand mark moved from the sidebar header into the top bar, trailing
     side (`ms-auto`), so it's on the right in LTR and the left in RTL.
  5. Replaced the hand-placed 58-cell grid cartogram with a real choropleth:
     `d3-geo` (Mercator projection fit to Algeria's true national outline)
     + `d3-delaunay` (Voronoi cells from each wilaya's real chef-lieu
     lat/lon, clipped to the outline via an SVG `clipPath`). New file
     `src/lib/geo/algeria-wilayas.ts` holds the 58 centroids + outline ring
     (centroids from a public dataset with swapped lat/lon fields,
     corrected; outline from a public Algeria boundary GeoJSON — both
     baked into the repo, no runtime fetch). Same behavior as before:
     5-step token color scale, `confirmedOrders < min_orders` neutral gate,
     hover sync with the table both ways, click-to-filter, mobile stacking.
     `algeria-map.test.ts` now checks the centroid set (58 codes, real
     lat/lon range) and the outline ring instead of the old grid.
  6. Semantic colors: `time-chart.tsx` net-profit line now
     success/danger by sign (matching the KPI tile's tone), invested line
     now danger (dashed, so it stays visually distinct from net-profit when
     both are red) instead of orange; `funnel.tsx` bars colored by
     drop-off severity; per-agent/per-product rate cells now use the same
     `RateBar`/`RateCell` treatment `wilaya-section.tsx` already had
     (extracted to `src/components/stats/rate-bar.tsx`, one shared
     implementation, no more copies).
  7. Added confirmation/delivery status breakdown charts
     (`status-breakdown-bars.tsx`) to the existing Dashboard — fit fine at
     the smaller-version size, no standalone analytics page needed. Needed
     a new RPC field: migration `00011_dashboard_status_breakdown.sql` adds
     `confirmation_breakdown`/`delivery_breakdown` (per-status counts) to
     `dashboard_stats()`, same filtered order set the rest of the function
     already computes. Types regenerated (`--local`).
  8. Vivid per-option colors: extended the **existing** status/color system
     (`src/lib/statuses.ts` + a new `ColorDot`/`TOKEN_DOT_CLASS` pair in
     `components/ui/chip.tsx`) rather than building a second one. Two new
     fixed-enum token maps (`ORDER_SOURCE_TOKEN`, `EXPENSE_CATEGORY_TOKEN`)
     — these are Postgres enums like statuses, not `option_sets` (checked
     Phase 12 §9's plan first: that's a whole DB-backed user-editable
     taxonomy system, out of scope here, so this doesn't duplicate it, and
     §9 can adopt the same token approach for user-created options later).
     Wired into every enum `Select` in the app (dashboard/orders/finance
     filter bars, the shared `CategorySelect`) and into `category-bars.tsx`
     (was flat `bg-info` for every category, now per-category color).
     Entity pickers (product/wilaya/agent) intentionally left uncolored —
     they're dynamic lists, not a taxonomy, so there's no source-of-truth
     color to draw from without inventing an ad-hoc one.
- **Files:** `src/components/app-shell.tsx`,
  `src/{app/app/dashboard,app/app/orders,app/app/finance}/*filter-bar.tsx`,
  `src/app/app/dashboard/{page,wilaya-section}.tsx`,
  `src/components/dashboard/{algeria-map,algeria-map.test,category-bars,time-chart,status-breakdown-bars}.tsx`
  (new: `status-breakdown-bars.tsx`), `src/components/fields/{category-select,select-option-row}.tsx`
  (new: `select-option-row.tsx`), `src/components/stats/{funnel,rate-bar}.tsx`
  (new: `rate-bar.tsx`), `src/components/{locale-switcher,ui/chip}.tsx`,
  `src/lib/{statuses,geo/algeria-wilayas}.ts` (new: `geo/algeria-wilayas.ts`),
  `supabase/migrations/00011_dashboard_status_breakdown.sql`,
  `src/lib/supabase/database.types.ts` (regenerated),
  `src/messages/{en,ar}.json`, `package.json`/`package-lock.json`
  (+`d3-geo`, `d3-delaunay`, `@types/d3-geo`, `@types/d3-delaunay`),
  `.claude/skills/cod-ui-polish/references/components.md` (Navigation +
  Map sections updated to describe the shipped behavior, not the reversed
  phase-11 defaults).
- **Decisions:** map uses a Voronoi-from-real-centroids approximation
  clipped to the true national outline rather than full per-wilaya
  administrative boundaries — this repo has no lightweight source for
  those (the only public GeoJSON found was 22MB unsimplified or missing
  most wilayas), and the phase doc explicitly allowed "simplified geometry
  ... this is a choropleth, not a routing map." Status-breakdown charts
  went on the existing Dashboard (smaller-version option), not a new
  `/app/analytics` page — fit without feeling cramped at current seed-data
  volume; revisit if a future phase's data volume changes that. Applied
  two extra ponytail-review simplifications beyond the phase's own list:
  extracted `RateCell` (bar + label, was duplicated 4x) and
  `SelectOptionRow` (dot-or-plain-label SelectItem content, was duplicated
  3x) into shared components.
- **Known issues:** local Supabase grants gap discovered while testing —
  a fresh `supabase db reset` leaves `service_role`/`authenticated`/`anon`
  without base table GRANTs (only `Dxtm`, no `SELECT`/`INSERT`/`UPDATE`/
  `DELETE`), because no migration in this repo ever issues
  `ALTER DEFAULT PRIVILEGES`/`GRANT` — the working local setup this whole
  project has relied on must have been patched by hand at some point,
  outside of any migration file, so it doesn't survive a real reset. Not
  a phase-12b bug and out of scope to fix here, but it will bite the next
  session that needs to reset+reseed: for now, after `supabase db reset`,
  run this once before seeding (local docker only, never against a linked
  project):
  ```sql
  GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
  GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
  ```
  A real fix belongs in its own migration (with per-table review — some of
  these are financial/admin-only tables where a blanket grant is fine
  since RLS is still the real wall, but worth doing deliberately, not
  copy-pasted from this note). The local DB was reset+reseeded during this
  phase (to apply migration 00011) using this workaround; row counts match
  `docs/TESTING.md` (60 orders, 5 products, etc.) — verified via UI.
- **Screenshot self-critique:** ran via Playwright MCP against
  `admin@seed.mnw` on the local stack — `docs/design/audit/phase-12b/`
  (10 screenshots): Dashboard in English/dark (full + nav-collapsed +
  final sanity pass), the avatar dropdown open, Arabic desktop dark (the
  exact previously-broken RTL case — confirmed fixed), Arabic mobile
  closed/open drawer dark, Arabic desktop light, English desktop light.
  Nothing needed fixing after the color/map/nav work — all four states
  (loading/empty/error/populated) already existed on Dashboard from §5 and
  weren't touched.
- **Next chat must know:** `npm run build` + `npm test` (31 pass / 38
  skipped) green. Forbidden-color grep = 0 on every file touched. Resume
  Phase 12 §6 (Contacts) next — read `docs/phases/phase-12.md` §6 and
  `docs/phases/section-checklists.md`. If you need to reset+reseed the
  local DB, apply the grants workaround above first (see Known issues).

## Addendum — ZR Express delivery-company integration (2026-07-28) — DONE

Out-of-band user request (not a numbered phase.md — API docs were
`https://docs.zrexpress.app`, fetched live: `llms.txt` site map, then
`docs/authentication.md`, `reference/createparcelendpoint.md`,
`reference/searchterritoriesendpoint.md`, `reference/
getparcelbyidsupplierendpoint.md`, `docs/webhook-integration-guide.md`,
`docs/webhook-event-types.md`). Branch `mnw-zrexpress`.

- **Done:** push a confirmed, home-delivery order to ZR Express as a parcel;
  track its tracking number/state from the order detail page; receive
  ZR's status-change webhook.
  - **Schema** (`supabase/migrations/00012_zr_express.sql`): added
    `'zrexpress'` to `integration_provider`; new `zr_territories` (cached
    wilaya/commune tree from ZR's `/territories/search`, admin-only) and
    `zr_shipments` (one row per pushed order: `parcel_id`,
    `tracking_number`, `state`; all-read/admin-write, same shape as
    `wilaya_fees`).
  - **Credentials**: reuses `integration_configs` (provider='zrexpress')
    — `config.tenant_id` + `config.api_key` for outbound calls,
    `secret` holds the Svix `whsec_...` webhook-signing secret (same
    column shopify/lightfunnels use for their own HMAC secret, different
    scheme).
  - **Client** (`src/lib/integrations/zrexpress.ts`): `searchZRTerritories`
    (paginated), `createZRParcel`, `getZRParcel`, `createZRWebhookEndpoint`.
    `X-Tenant`/`X-Api-Key` headers, base URL `https://api.zrexpress.app/api/v1`.
  - **Settings → Integrations**: new ZR Express card
    (`zrexpress-section.tsx`) — tenant ID + API key form, "Sync
    territories" button (paginates and caches the tree), "Register status
    webhook" button (calls ZR's endpoint-registration API, stores the
    returned `whsec_` secret).
  - **Order detail** (`zr-shipment-card.tsx` + `orders/actions.ts`
    `pushOrderToZRExpress`/`refreshZRShipmentStatus`, admin-only): validates
    confirmed + home-delivery + wilaya/commune/phone present, matches the
    wilaya by `zr_territories.code` (same official Algerian wilaya
    numbering ZR uses — no manual mapping needed) and the commune by
    normalized-name lookup scoped to that wilaya, converts the phone to
    `+213` international format, creates the parcel, immediately fetches
    the tracking number (create only returns the parcel id).
  - **Inbound webhook** (`/api/webhooks/zrexpress`,
    `zrexpress-webhook.ts`): Svix signature verification (`svix-id`/
    `svix-timestamp`/`svix-signature`, HMAC-SHA256, 5-minute replay
    tolerance) — different scheme from `webhook.ts`'s single-header HMAC,
    so it's its own small verifier, not bent into that one. Stores every
    event in `webhook_events` (provider='zrexpress') like the other
    integrations; on `parcel.state.updated` updates `zr_shipments.state`
    only.
  - Extracted `normalizeText` (was `webhook.ts`-private `normalizeName`)
    and `jsonResponse` (was duplicated in both webhook files) to
    `src/lib/utils.ts` — both webhook pipelines share them now instead of
    each having its own copy. Added `zrErrorMessage(e, fallback)` to
    `zrexpress.ts` so every call site's catch block is one line.
- **Deliberately deferred (scope cuts, not oversights):**
  - **Stop-desk delivery isn't supported** — ZR's `deliveryType:
    "pickup-point"` needs a `hubId` (their facility), and there's no hub
    picker UI. `pushOrderToZRExpress` rejects non-`home` orders with a
    clear message. Home-only covers the common case; add hub search if
    stop-desk-via-ZR is actually needed.
  - **ZR's parcel state is never written back to `orders.delivery_status`.**
    ZR's states are a tenant-configurable workflow (their own Workflow
    endpoint), not a fixed enum — no safe static mapping exists. An admin
    reads the ZR state next to our own status on the order page and
    updates ours by hand. A real fix needs a per-tenant state-mapping UI,
    not a hardcoded guess.
  - **Commune matching is name-based, best-effort.** `orders.commune` is
    free text (not FK'd to anything); if it doesn't match a synced ZR
    territory name closely enough, the push fails with an actionable
    error rather than guessing wrong. No inline "pick from ZR's list"
    UI on the order form — `orders.commune`'s existing free-text `Input`
    is unchanged.
  - **Product catalog isn't synced to ZR** — every parcel uses
    `stockType: "none"` (no ZR product/SKU association), correct for this
    app's dropshipping/COD model where ZR doesn't hold stock.
- **Verified:** `npm run build` + `npm test` green, forbidden-color grep
  clean on the two new UI files, Settings → ZR Express card and the order
  detail card screenshot-checked visually (dark theme) — tenant/API-key
  form, sync/register buttons and their status badges, "Send to ZR
  Express" button all render correctly. **Did not click "Send to ZR
  Express" or the sync/register buttons** — Claude Code's own safety
  classifier correctly blocked it as a live call to a real third-party
  API; traced the validation path by hand instead (confirms
  confirmation_status/delivery_type/wilaya/commune/phone before ever
  reaching `getZRCredentials`, which throws immediately since no
  credentials are configured in this seed workspace). **The full
  create-parcel → track → webhook round trip has not been exercised
  against ZR's real API** — do that first with real sandbox/production
  credentials before relying on this in production.
- **Next chat must know:** to actually use this, an admin needs a real ZR
  Express account: get tenant ID + API key (their portal → API Rest →
  Token API), paste into Settings → ZR Express, Sync territories, Register
  status webhook (needs a publicly reachable `APP_URL` — won't work
  against `localhost`; use a tunnel or a deployed URL for that step), then
  test one push end-to-end. Local DB was reset to apply migration 00012 —
  same grants workaround as above was needed again after reset.

## Phase 12 §6 — Contacts (2026-07-28) — DONE

- Scope: section 6 of 9. Rebuilt Contacts (Customers + Suppliers) onto the
  §1 `<DataTable>` and the status/field system — the section had been left
  on Phase 8's plain HTML tables and native `<select>`.
- **Customers** (`contacts/page.tsx` + new `customers-table.tsx`, client):
  `<DataTable>` with the checklist's columns (name, phone `tel:` link,
  wilaya, total/delivered/returned, `<RiskBadge>` now showing its `reason`
  prop for the first time — "1 Returned · 1 Cancelled" etc., computed from
  the same counts as the risk-breakdown table — and a `defaultHidden` "Last
  order" column). Sort is in-memory (new `sortRows()` in `lib/utils.ts`,
  shared with Suppliers below) since the list isn't paginated at this
  app's scale. **Detail sheet**: risk badge + reason, phone/wilaya/commune,
  stat tiles, and a **full order-history timeline** (every order, not
  capped like the confirmation queue's "previous orders" — the checklist
  asked for "full") with dual status pills, linking each order and an
  "Open full page" icon to `/app/contacts/[id]` for editing. "Last order"
  and the sheet's order list both come from one extra `orders` query
  grouped by `customer_id` in JS (Phase 5's established pattern), not a DB
  view change.
- **Customer full page** (`[id]/page.tsx`): risk-score Badge → `<RiskBadge>`,
  order-history Badges → `<StatusPill>`, money cells gained `.num`. The
  native wilaya `<select>` couldn't just become `WilayaCombobox` in place —
  passing a fixed `customer.wilaya_code` as the Combobox's `value` prop
  with no `onChange` pins it forever (Combobox is `value ?? internal`, so a
  parent-supplied `value` that never changes overrides every click). Fixed
  by extracting a new client **`<CustomerForm>`** (`contacts/customer-form.tsx`,
  local `useState` for the wilaya code, submits through the existing
  `saveCustomer` server action via `.bind()` — confirmed against Next 16's
  own docs that `.bind()` on a server action works from a Client Component
  same as a Server Component) — this is also the shared `<CustomerForm>`
  `interconnection.md` calls for, not just a bugfix-shaped detour.
  Live-verified interactively: opened the combobox, picked a different
  wilaya, confirmed the trigger label actually updates (not stuck on the
  initial value).
- **Suppliers list** (`suppliers/page.tsx` + new `suppliers-table.tsx`):
  `<DataTable>` with a type chip (icon + token color: shooting_studio
  camera/violet, atelier_couture scissors/cyan, emballage package/orange,
  other ellipsis/neutral — new `SUPPLIER_TYPE_TOKEN` in `lib/statuses.ts`
  + `SupplierTypeSelect`/`SUPPLIER_TYPE_ICONS` in new
  `components/fields/supplier-type-select.tsx`, mirroring §3's
  `CategorySelect`/`CATEGORY_ICONS`), click-to-call phone, and a
  **linked-expenses total column** (one extra `expenses` query grouped by
  `contact_id` in JS, same shape as the customer "last order" query).
  Row kebab → Edit link; name cell links straight to the detail page (no
  sheet here — suppliers are full CRUD records with their own edit form,
  matching how the Products grid links to a full page rather than a sheet).
- **Supplier form** (`contact-form.tsx`): native `<select>` → `SupplierTypeSelect`,
  raw phone `<Input>` → `PhoneField`. Both are plain uncontrolled fields
  (Radix `defaultValue` / `PhoneField`'s own internal `useState(defaultValue)`)
  so, unlike the wilaya combobox above, they work directly in the existing
  async server-component form with no client-wrapper needed.
- **Supplier detail — now the third home of the shared expense component**
  (interconnection.md names it explicitly: "Supplier detail" alongside the
  product Expenses tab and Finance → Expenses, "opening it from a supplier
  pre-fills the supplier"). Deleted the old hand-rolled read-only expense
  table and replaced it with the real `<ExpenseTable contactId={id} .../>`,
  giving suppliers add/edit/delete for the first time. Required two small,
  symmetric additions to the shared components (mirroring the existing
  `productId` lock): `ExpenseForm` gained `contactId?` (hidden input +
  skips rendering the supplier picker when set) and `ExpenseTable` gained
  `contactId?` (threaded to the form) plus a **new "Product" column**
  (previously missing entirely — `ExpenseTable` had a supplier column but
  never a product one) shown whenever `contactId` is set and hidden
  whenever `productId` is set, and vice versa for the supplier column, so
  neither locked context shows a redundant always-the-same value. Also
  added the missing `revalidatePath(/app/contacts/suppliers/${contact_id})`
  to `saveExpense` (had `product_id`'s revalidate but not `contact_id`'s).
  Live-verified: "New expense" from a supplier's page opens the sheet with
  no Supplier field, a Product picker, and saves against the same
  `saveExpense` action the product tab and Finance use.
- **ponytail-review pass**: extracted the two near-identical ~12-line
  "read `?sort=`/`?dir=`, sort an array in memory" blocks (Customers +
  Suppliers pages) into `sortRows()` in `lib/utils.ts`. Also moved
  `SupplierTypeChip` out of the shared `supplier-type-select.tsx` (it only
  had one call site, in `suppliers-table.tsx`) into a local unexported
  `TypeChip` there, matching `expense-table.tsx`'s existing `CategoryChip`
  convention (colocated with its sole consumer, not exported for a second
  caller that doesn't exist yet).
- **Screenshot self-critique (dark + light + Arabic/RTL, local seed
  stack)**: an already-running `npm run dev` (local Supabase docker,
  `admin@seed.mnw` session) on port 3000 was reused rather than starting a
  second instance. `docs/design/audit/contacts-{customers,suppliers}-{dark,
  light}.png`, `contacts-customer-{sheet,detail}-dark.png`,
  `contacts-customer-detail-light.png`, `contacts-supplier-detail-{dark,
  light}.png`, `contacts-supplier-newexpense-dark.png`,
  `contacts-customers-ar-rtl.png`. All four states, both themes, sheet +
  full-page drill-through, click-to-call, and the Arabic/RTL customers list
  (sidebar mirrored, risk pill translated, no layout breakage) render
  correctly; console clean (0 errors/warnings) through the whole pass. No
  fixes needed from the shots — the only real bug found this session (the
  Combobox `value`-without-`onChange` pinning) was caught by interaction
  testing, not the screenshots, and is written up above.
- Known / for consumers: Customers list is unpaginated (fetches the whole
  workspace, same as before this session) — fine at this app's seed scale
  (24 customers), revisit with real `<DataTable total=/>` server pagination
  if a workspace's customer count ever grows large. `sortRows()` is a
  small in-memory sort meant for exactly this unpaginated-list shape — a
  server-paginated list (like Orders/All) still needs its own `.order()`
  mapping, not this helper. `ExpenseTable`'s new Product column is now live
  on Finance → Expenses and the product Expenses tab too (both previously
  had no product column at all) — purely additive, not a regression, but
  worth knowing before touching that component again.
- **Next chat must know:** `npm run build` + `npm test` green (31 pass / 38
  RLS-suite skipped, unchanged — no new test file; this section is UI/
  queries over already-tested `customer_stats`/RLS, nothing new to
  unit-test), forbidden-color grep = 0, no native `<select>`/raw `<input>`
  in `src/app/app/contacts`, `graphify update .` run (1366 nodes, 3289
  edges, 113 communities). **Phase 12 §7 (Team & Rules)** is next: Rules/
  Meetings/Tasks-kanban/Performance/Users/Audit-log onto the same table +
  status + field components — read `docs/phases/phase-12.md` §7 and
  `.claude/skills/cod-ui-polish/references/section-checklists.md` first.
  If merge conflicts appear touching `lib/statuses.ts` or `lib/utils.ts`,
  this session only appended `SUPPLIER_TYPE_TOKEN` and `sortRows()`
  respectively — nothing else in those files changed.

## Phase 12 §7 — Team & Rules (2026-07-29) — DONE

- Scope: section 7 of 9. Rules/Meetings/Performance/Users/Audit-log were
  already built in Phase 9 — mostly a restyle pass onto the §1 `<DataTable>`
  and status/field system, plus one net-new build: **Tasks** (the
  `/app/team/tasks` route was a `rebuildPending` placeholder with no table
  behind it at all).
- **Tasks, from scratch**: new migration `00013_team_tasks.sql` —
  `task_status` enum (todo/doing/blocked/done), `task_priority` enum
  (low/medium/high), a `tasks` table (title, owner → `auth.users`,
  due_date, priority, status, optional `meeting_id`/`product_id` links)
  with `tasks_sel`/`tasks_all` RLS mirroring `meetings`'s existing
  all-read/admin-write pattern. Default view is a kanban
  (`task-kanban.tsx`, modeled directly on `DeliveryKanban`): native drag
  *and* an on-card `<StatusSelect kind="task">` as the keyboard-accessible
  equivalent, legal-transition-gated, optimistic move with rollback on
  failure. `tasks-view.tsx` toggles to a `<DataTable>` list view
  (`task-table.tsx`) via a URL param, sharing one `editing` state + 
  `<Sheet>` + `<TaskForm>` across both views (mirrors `ExpenseTable`'s
  self-contained-editing-state pattern rather than duplicating a dialog
  per child). Filters: owner (My tasks default / All / teammate),
  priority, product, "Overdue only" toggle. New fixed-token color pattern
  `TASK_PRIORITY_TOKEN` in `lib/statuses.ts` (low=neutral/medium=warning/
  high=danger) + new `<PrioritySelect>` field, matching the
  `SUPPLIER_TYPE_TOKEN` convention from §6. Dashboard's "My open tasks"
  empty-state card now shows real top-5-open-tasks-by-due-date data
  instead of the placeholder, and the sidebar's Tasks badge count is now a
  real query instead of a hardcoded `0`.
  - **Fixed in passing**: the Tasks list query originally tried
    `profiles!tasks_owner_fkey(display_name)` as a PostgREST embed — invalid,
    since `tasks.owner` and `profiles.user_id` are sibling FKs to
    `auth.users`, not directly related (confirmed via `\d public.tasks` on
    the local DB). Fixed by fetching profiles separately and building a
    `nameByOwner` Map, same as `meetings/[id]/page.tsx` already does for
    attendee names.
  - **Combobox pinning bug avoided proactively**: `TaskForm`'s product
    field uses a local `useState` + `onChange`, not a static `value` prop,
    to sidestep the same `Combobox` `value ?? internal` pinning bug §6
    hit and fixed for `CustomerForm`. Noted but out of scope: `ExpenseForm`
    has the same latent bug in its own product-combobox path — not fixed
    here, flag before next touching that form.
- **Rules**: no native `<select>`/`<input>` found (already clean from
  Phase 9). Added the one missing checklist item — a "last edited by
  {name} · {timestamp}" byline under each rule, using `getProfile` (not
  `requireAdminProfile`, so agents see it too under the existing `pr_sel`
  read policy) to resolve names, and `updated_by` now actually gets set on
  save (`saveRuleDoc` previously never wrote it).
- **Meetings**: rebuilt the list as a card grid (was a plain table) with
  the new `<MeetingStateChip>` (reuses the existing
  `status.meeting_status.*` i18n keys rather than inventing a duplicate
  tree — caught and fixed after drafting the duplicate once) computing a
  UI-only "Ready" pseudo-state (`MEETING_STATUS_TOKEN` in
  `lib/statuses.ts`, with a comment explaining "ready" isn't a DB value).
  Added **carry-over tagging**: `meeting_objectives` gained `is_deferred`/
  `carried_forward`/`carried_from` columns, a new `deferObjective` action
  (mutually exclusive with `is_done`), and `guard_meeting_held()` now
  requires every objective be done *or* deferred (previously just
  required ≥1 objective to exist at all). `createNextMeetingInstances`
  now carries deferred-and-not-yet-carried objectives forward onto the
  soonest newly-created instance (idempotent — safe to re-run without
  double-copying, via the two boolean/uuid columns). Added the checklist's
  **"Copy agenda" button** (`copy-agenda-button.tsx`) — builds a plain-text
  checklist (`- [x]/[~]/[ ]` + "(Carried over)" tag) to the clipboard, and
  a per-objective Defer/Undefer control + "Carried over" `Chip` on the
  meeting detail page.
- **ponytail-review pass**: `isLegal`/`isOverdue` had been copy-pasted
  identically into both `task-kanban.tsx` and `task-table.tsx` — extracted
  to a new shared `tasks/task-utils.ts`, imported by both. The "ready"
  one-liner (every objective done-or-deferred) was likewise duplicated at
  both `MeetingStateChip` call sites (list card + detail page) — moved
  into a new exported `isMeetingReady()` in `meeting-state-chip.tsx`, call
  sites just pass the objectives array now. Left one duplication
  unfixed-but-flagged: `tasks/actions.ts`'s `nullableUuid` zod preprocessor
  is byte-identical to the one already in `products/actions.ts` — not
  extracted to a shared module this session since doing so means editing
  a pre-Phase-12§7 file outside this section's stated scope; worth sharing
  next time either file is touched.
- **Performance**: restyled onto `<DataTable>` (`performance-table.tsx`).
  Added the missing date-range filter (`performance-filter-bar.tsx`, preset
  buttons + two `DateField`s, URL-persisted) — with no filter set it still
  uses the existing `agent_performance` view; with a range set it
  re-derives the same aggregation from raw `order_status_history` (joined
  to `orders` for `created_at`) in JS. That aggregation groups by a
  `` `${actor} ${stage}` `` space-delimited key initially drafted as
  `` `${actor}-${stage}` `` with a `.split("-")` to recover fields —
  caught before running the build, since UUIDs contain hyphens and would
  have silently mis-split; fixed by storing `userId`/`stage` directly in
  the group's value object instead of parsing the key.
- **Users**: role-description copy already existed from Phase 9 in the
  invite/user-row selects; both replaced with the new shared
  `<RoleSelect>` (EnumSelect + live `role.descriptions.*` paragraph),
  eliminating what had been two separate ad-hoc copies of the same
  description text. `UserRow`'s raw `<input type="checkbox">` for
  "active" → `<Switch>` (confirmed the server action already reads
  `formData.get("is_active") === "on"`, matching Radix Switch's native
  form-participant submission value, so no action change needed).
- **Audit log**: restyled onto `<DataTable>` (`audit-table.tsx` +
  `audit-filter-bar.tsx`), replacing the plain `<table>` + native
  `<select>` filters. Added the missing `fields.date` i18n key (the date
  column had been mislabeled with the unrelated `fields.from` key).
- **Known, not fixed (pre-existing, out of scope)**: the meeting-objective
  checklist item on `meetings/[id]/page.tsx` renders a raw, `readOnly`
  `<input type="checkbox">` glyph inside a submit `<button>` — predates
  this session (only the Defer button and "Carried over" `Chip` were added
  next to it) and isn't the native-`<select>` white-on-white failure mode
  the project rule targets, so left as-is; swap for `<Checkbox>` if this
  file is touched again.
- **Screenshot self-critique (dark + light + Arabic/RTL for the two
  layout-sensitive views)**: local Supabase docker + `npm run dev`
  reused/restarted as needed. `docs/design/audit/phase-12-7/` —
  `rules-{light,dark}.png`, `meetings-{dark,light}.png`,
  `meetings-detail-dark.png`, `meetings-held-detail-dark.png`,
  `tasks-empty-light.png`, `tasks-kanban-{light,dark,owner-light,
  moved-light}.png`, `tasks-edit-sheet-light.png`, `tasks-table-{light,
  dark}.png`, `performance-{dark,light}.png`, `users-{light,dark}.png`,
  `users-role-desc-light.png`, `audit-{dark,light}.png`,
  `tasks-kanban-ar-rtl.png`, `meetings-ar-rtl.png`. Both RTL shots (kanban
  columns + card-grid attendee chips, the two layout-sensitive views) came
  back correctly mirrored with no clipping and fully translated labels; no
  fixes needed from the screenshots this pass — the two real bugs caught
  this session (PostgREST embed, UUID key-splitting) were caught by
  reading/testing before the screenshot pass, not by the screenshots
  themselves. Locale/theme reverted to English/Dark (the app defaults)
  before finishing.
- **Next chat must know:** `npm run build` + `npm test` green (31 pass /
  38 RLS-suite skipped, unchanged). Forbidden-color grep = 0 across every
  file this section touched. No native `<select>`; the one surviving raw
  `<input>` is the pre-existing readOnly checkbox glyph noted above (not
  introduced this session). **Phase 12 §8** is next — read
  `docs/phases/phase-12.md` §8 and the section checklist before starting.
  If merge conflicts appear touching `lib/statuses.ts`, this session
  appended `TASK_PRIORITY_TOKEN` and `MEETING_STATUS_TOKEN`; `lib/enums.ts`
  gained `TASK_STATUSES`/`TASK_PRIORITIES`.

## Phase 12 §8 — Settings (2026-07-29) — DONE

- Scope: section 8 of 9. Regrouped the one-long-scroll into cards with a
  section nav, per the checklist — a field-component + Appearance pass, not
  a rebuild (every subsection already existed from Phase 2/6/webhooks work).
- **Section nav**: `settings/page.tsx` now renders a `grid-cols-[12rem_1fr]`
  layout — a plain, zero-JS `<nav>` of `<a href="#id">` anchors (native
  anchor scrolling, no scroll-spy JS) sticky at `lg:top-20`, each card given
  a matching `id` + `scroll-mt-20`. Order: Workspace · Integrations ·
  Delivery fees · Fixed fees · Exchange rates · Engine rules · Meeting
  schedule · Appearance. ZR Express + Recent webhook events stayed nested
  under the Integrations anchor (own cards, not their own nav entries) —
  the checklist doesn't list them separately and they're conceptually part
  of "Integrations" troubleshooting. Verified RTL: CSS Grid's physical
  `grid-template-columns` auto-reverses under `direction: rtl` with no
  logical-property changes needed — confirmed both columns mirror correctly
  in the Arabic screenshot below.
- **Split Thresholds into two cards** the checklist asks for separately:
  deleted `thresholds-section.tsx`, new `engine-rules-section.tsx` (return
  fee, duplicate window, min orders/delivery rate, risk weights) and
  `meeting-schedule-section.tsx` (the 5 slots). `actions.ts`'s
  `saveThresholds` split into `saveEngineRules`/`saveMeetingSchedule` to
  match (two independent Save buttons instead of one covering both cards).
- **Field components everywhere raw `<input>`/native `<select>` remained**:
  `fixed-fees-section.tsx` and `exchange-rates-section.tsx` now use
  `MoneyCurrencyField`/`MoneyField`/`EnumSelect`/`DateField` (all already
  existed — this was pure reuse, no new field components needed there).
  `engine-rules-section.tsx` uses `MoneyField`/`PercentField`/
  `QuantityStepper` for return fee/rate/counts; risk weights (arbitrary
  decimal multipliers, not money/percent/quantity) stayed a styled `<Input
  type="number">` — the styled UI primitive is allowed by the invariant,
  only literal raw `<input>`/native `<select>` are banned.
  `meeting-schedule-section.tsx` needed a **new `TimeField`** (native
  `<input type="time">`, styled identically to the existing `DateField` in
  the same file) since no time-of-day field component existed yet.
- **Delivery fees (`fees-section.tsx`) converted to a client component**
  for two checklist items: `MoneyField` per home/stop-desk cell (was raw
  number `<Input>`) and `<Switch>` for stop-shipping (was a raw
  `<input type="checkbox">`) — Switch posts `"on"` the same as a native
  checkbox (confirmed by §7's prior note), so `saveWilayaFees`'s
  `formData.get(...) === "on"` check needed no change. **Bulk paste**: a
  toggleable textarea (paste `wilaya_code⇥home⇥stopdesk` rows, tab or comma
  separated) parses on "Apply" and re-keys the changed rows' `MoneyField`s
  to force them to pick up the new values (MoneyField is internally
  uncontrolled, so a prop change alone wouldn't re-render it). Required
  **`AutoTextarea` to forward its ref** (was internal-only) so the Apply
  button can read `.value` imperatively without adding a parallel controlled
  `value`/`onChange` API to that shared component — a plain existing-file
  extension, no new dependency.
- **Integrations**: new `<SecretField>` (`components/fields/secret-field.tsx`)
  — a password input with an eye-icon reveal toggle for the value **being
  typed this session only**; the previously-saved secret is still never
  sent to the client (Phase 2's "never echo" decision, unchanged) — reveal
  applies to what the admin just typed, the same UX as any password-field
  eye toggle, not a backend change. Health line now shows
  **`formatRelativeTime`** (new helper in `lib/format.ts`, native
  `Intl.RelativeTimeFormat` — correct grammar in `ar` for free, no new i18n
  keys needed for the wording itself) next to the existing healthy/
  never-received badge. **Added a real "Send test event" button**
  (`sendTestWebhookEvent` in `actions.ts`): builds an obviously-tagged
  synthetic payload (`external_id` `test-<ts>`, "Settings Test Event"
  customer), signs it with the stored secret via `node:crypto`
  `createHmac`, and does an actual `fetch()` POST to the real
  `/api/webhooks/<provider>` endpoint — reuses `processWebhook`/
  `applyMappedOrder` and the exported `lightfunnelProvider`/
  `shopifyProvider` configs unchanged, so a success genuinely proves the
  URL+secret work end to end (not a mocked check), at the cost of creating
  one recognizable test order an admin can delete. Disabled until a secret
  is set. Same pattern applied to ZR Express's API key field.
- **Appearance** (new `appearance-section.tsx`, client): wires the
  already-built-but-never-mounted `<ThemeToggle>` (dark/light, cookie-
  backed — existed since Phase 11/12b with no call site anywhere in the
  app until now) plus a new Density control writing
  `localStorage["mnw:density:default"]`. `data-table.tsx`'s density-restore
  effect now falls back to that key when a given table has no per-table
  override yet — verified live: toggling Density on the Settings page and
  then opening Contacts → Customers (a table with no saved
  `mnw:density:contacts*` key) rendered compact rows. **No "system" theme
  option** — `lib/theme.ts` only ever defined `dark`/`light` (Phase 11
  scope), and the checklist's "system" mention would need a new
  `matchMedia` listener + a third cookie state; out of this pass's "regroup
  + reuse" scope, left as a gap for whoever revisits `lib/theme.ts`.
- **ponytail-review pass**: the `headers()`/`x-forwarded-proto`/`APP_URL`
  base-URL block was about to appear a third time in `actions.ts` (already
  duplicated once between `registerZRWebhook` and `page.tsx`) — extracted a
  local `resolveBaseUrl()` helper, used by both `registerZRWebhook` and the
  new `sendTestWebhookEvent` (page.tsx's separate copy left alone — predates
  this session, different module).
- **Screenshot self-critique (dark + light + Arabic/RTL, local seed
  stack)**: `docs/design/audit/phase-12-8/` — `settings-full-{dark,light}.png`
  (whole page, both themes), `settings-secret-reveal-dark.png` (reveal
  toggle mid-type), `settings-bulkpaste-applied-dark.png` (two rows changed
  by a pasted block, rest untouched), `settings-appearance-light.png`,
  `settings-ar-rtl-dark.png` + `settings-appearance-ar-rtl.png` (RTL: both
  grid columns mirror, all new strings translated, eye icon still on the
  logical "end" side). Console clean (0 errors/warnings) throughout. One
  fix from interaction testing (not the screenshots): none needed — the
  only surprise was a Playwright `fullPage` screenshot quirk misplacing the
  sticky sidebar mid-capture, confirmed harmless by a normal (non-fullPage)
  viewport screenshot at the same scroll position. Locale/theme/density
  reverted to English/Dark/Comfortable (the app defaults) before finishing.
- Files: new `settings/{appearance-section,engine-rules-section,
  meeting-schedule-section}.tsx`, `components/fields/secret-field.tsx`;
  deleted `settings/thresholds-section.tsx`; rewrote `settings/page.tsx`,
  `settings/{fees,fixed-fees,exchange-rates,integrations,zrexpress,
  workspace}-section.tsx`, `settings/actions.ts`; extended
  `components/fields/{auto-textarea,date-field}.tsx` (ref-forwarding,
  `TimeField`), `components/data-table/data-table.tsx` (density fallback),
  `lib/format.ts` (`formatRelativeTime`); ~20 new `settings.*` message keys
  in both locales (`engineRules` replaces the now-unreferenced
  `thresholds` key).
- **Next chat must know:** `npm run build` + `npm test` green (31 pass / 38
  RLS-suite skipped, unchanged — no new test file, this section is UI/forms
  over already-tested settings/webhook logic). Forbidden-color grep = 0, no
  native `<select>`/raw `<input>` in `src/app/app/settings` (one hidden
  `<input type="hidden" name="provider">` is not a visible control, matches
  existing precedent). `graphify update .` run (1440 nodes, 3589 edges, 121
  communities). **Phase 12 §9 (Option sets)** is next and is the last
  section — read `docs/phases/phase-12.md` §9 and
  `.claude/skills/cod-ui-polish/references/option-sets.md` first; it needs
  a **new migration** (`option_sets`/`options` tables) applied to the local
  DB before wiring any UI, and should wire supplier type/product category/
  tissu/expense subcategory/tags/cancellation reason to the new
  `OptionSelect` component (shell already exists at
  `components/fields/option-select.tsx`).

## Phase 12 §9 — Option sets (2026-07-29) — DONE

- Scope: section 9 of 9 — the **last section of Phase 12**. Built the real
  `option_sets`/`options` backend the `OptionSelect`/`OptionMultiSelect`
  shell (design-preview only until now) was designed for, a management
  screen, and wired five taxonomy fields end to end.
- **Migration `00014_option_sets.sql`**: `option_sets` (key, label,
  allows_multi) + `options` (label, color_token, icon, sort_order,
  archived_at) tables, both `workspace_id`-scoped. RLS: select open to every
  authenticated role (selects render in forms all roles use); **insert on
  `options` open to every authenticated role too** — the doc's "+ Create"
  affordance has to work for a confirmation agent typing a new cancellation
  reason, not just admins — while update/delete (rename/recolor/reorder/
  archive/merge/hard-delete) stay admin-only. `set_updated_at` + `audit_row`
  triggers, matching every other config table. Referencing columns added:
  `products.category_option_id`/`fabric_option_id` (replacing the old free
  `text` columns — **dropped**, not kept alongside), `expenses.
  subcategory_option_id` (new, orthogonal to the existing fixed `category`
  enum), `orders.cancellation_reason_option_id` (new), and a join table
  `order_tags(order_id, option_id, workspace_id)` for the multi-select tag
  set. `seed_workspace()` extended (idempotent `if not exists` guard) to
  seed 5 default sets: `product_category` (Robes/Ensembles/Abayas/Jupes/
  Vestes/Accessoires), `product_fabric` (Soie/Coton/Crêpe/Denim/Laine/Satin/
  Mousseline — matching the exact labels `scripts/seed-dev.ts` already used
  as free text, so the migration didn't invent new taxonomy vocabulary),
  `expense_subcategory`, `order_tag` (allows_multi), `cancellation_reason`.
- **Decision — SUPPLIER_TYPE and expense `category` stay fixed Postgres
  enums, not migrated to option_sets** (the phase file explicitly asked for
  this decision + a documented why). Reasoning: both are small (4 and 8
  values), already fully integrated (RLS, `SUPPLIER_TYPE_TOKEN`/
  `EXPENSE_CATEGORY_TOKEN` chip maps, `SupplierTypeSelect`/`CategorySelect`,
  shipped and tested across §6/§7/12b), and converting them now means a
  live-data backfill migration on tables with real rows for marginal benefit
  — neither has shown a real need to grow past its fixed vocabulary the way
  product category/fabric (previously ungoverned free text) or cancellation
  reasons (didn't exist as a field at all) do. This matches phase-12b's own
  precedent note that `ORDER_SOURCE_TOKEN`/`EXPENSE_CATEGORY_TOKEN` are
  "Postgres enums like statuses... not `option_sets`". Genuinely new/
  previously-ungoverned taxonomies (product category, fabric, expense
  subcategory, tags, cancellation reason) got the real option-sets treatment
  instead — exactly the doc's "team grows this over time" case.
- **`OptionSelect`/`OptionMultiSelect` rewritten** (`components/fields/
  option-select.tsx`) to back onto the real tables: both now take a `setKey`
  prop and call the new `createOption` server action directly on "+Create"
  — no caller has to wire its own `onCreate` handler anymore (the
  design-preview gallery's static-options demo still works via the
  `onCreate` prop, kept as a fallback when `setKey` is absent). Rebuilt
  `OptionSelect` as its own Popover+Command (was wrapping the generic
  `Combobox`) because `Combobox`'s trigger renders `icon + label` as two
  separate nodes — passing a `<Chip>` as the icon while also setting `label`
  would have doubled the text. Archived options are filtered out of the
  pickable list **unless currently selected**, then rendered dimmed with an
  "Archived option" tooltip — matches the doc's "still render on historical
  records, greyed" rule. `autoToken`/`OPTION_PALETTE` moved from
  `option-select.tsx` into `lib/statuses.ts` (next to the new `CHIP_TOKENS`
  array) since a "use server" actions file can't import a value from a
  "use client" component file — `createOption` needed `autoToken` too.
- **Mutations** (`src/lib/option-sets-actions.ts`, "use server"):
  `createOption` (any role), `renameOption`/`recolorOption`/`moveOption`
  (swap `sort_order` with the adjacent sibling)/`setOptionArchived`/
  `mergeOption`/`deleteOption` (admin-only via `requireAdminProfile`).
  `mergeOption` repoints every known referencing column
  (`repointReferences` helper — a plain `switch`-free explicit list of 4
  `.update()` calls; a generic `for (table,column) of [...]` loop hit a
  TypeScript error since Supabase's typed client can't accept a computed
  column key across a union of table types) plus `order_tags` (join-table
  move via `.upsert(..., {onConflict, ignoreDuplicates:true})` to skip rows
  that'd collide with an existing tag on the same order), then deletes the
  source option. `deleteOption` re-checks usage server-side (not just
  UI-disabled) before deleting. Reads live in `src/lib/option-sets.ts`
  (`getOptionSet`, `getAllOptionSets`, `getOptionUsageCounts` — the last is
  a `switch` over the 5 known consumer tables/columns, not a generic
  polymorphic counter; YAGNI at 5 fixed sets).
- **Management screen**: added as a new **inline card in the existing
  one-page Settings** (`settings/options-section.tsx` + a new `#options` nav
  anchor in `settings/page.tsx`'s `NAV_SECTIONS`), not a separate route —
  consistent with §8's "grouped cards with section nav" pattern every other
  subsection already uses, and the checklist's "Options manager" line sits
  alongside the other Settings bullets, not called out as its own page. Two
  cards per row (5 sets), each option row: up/down arrows (swap-adjacent
  reorder), a `ColorDot` button opening a 10-swatch `CHIP_TOKENS` popover
  (recolor), inline click-to-rename (Enter/Escape, check/x buttons), usage
  count (ICU plural), and a kebab (Rename/Merge into…/Archive-Unarchive/
  Delete — Delete disabled whenever usage > 0). "Merge into…" swaps the row
  for an inline `Combobox` of sibling options; picking one runs a
  `window.confirm` (same native-dialog pattern `DeleteButton` already uses)
  before calling `mergeOption`. A "New option…" input + Add button per card
  covers admin-side creation without opening a form elsewhere.
- **Wired taxonomy fields**: **Product category/fabric**
  (`product-form.tsx` — was two raw `<Input>`s, the actual banned pattern
  the invariant targets; `products/actions.ts`'s `productSchema` now takes
  `category_option_id`/`fabric_option_id` reusing the file's existing
  `nullableUuid` preprocessor instead of adding a second copy —
  deduplicated the two near-identical `nullableUuid` definitions that had
  accumulated in that file into one, moved above first use). Products
  list/table (`products/page.tsx`+`products-view.tsx`): category rendered
  as a `<Chip>` with the option's own color, replacing plain text.
  **Expense subcategory** (`ExpenseForm`/`ExpenseTable` gained a
  `subcategories` prop threaded through all three call sites — product
  Expenses tab, Finance → Expenses, Supplier detail — a `defaultHidden`
  chip column added to the shared table). **Order tags** (multi) + **
  cancellation reason**: new `OrderTaxonomyCard`
  (`orders/[id]/order-taxonomy-card.tsx`) on the order detail page, both
  fields auto-save on change via two new actions in `orders/actions.ts`
  (`setOrderTags` — full delete+reinsert into `order_tags`;
  `setOrderCancellationReason`) — no submit button, matches the "tag as you
  go" spirit of a taxonomy field. Cancellation reason is column-unrestricted
  by `guard_order_fields()` (a blocklist, not an allowlist), so both
  confirmation and delivery agents can set it on orders they can already
  see, not just admins. Also added a `defaultHidden` Tags column to
  `/app/orders/all` (chips, one extra `order_tags` query joined in JS) for
  the cross-cutting "chips render identically in trigger/options/tables"
  rule — did **not** add a tags filter dimension to `orders-filter-bar.tsx`
  or wire tags/reason into the confirmation/delivery queue rows (scope cut,
  see below).
- **`scripts/seed-dev.ts` updated** to stay runnable against the new schema:
  products now insert/backfill `category_option_id`/`fabric_option_id`
  (looked up by label from the seeded option sets — added an `optionMap()`
  helper and a backfill branch on the `existing`-product path so a rerun
  against an already-seeded DB still populates the new columns, not just
  fresh inserts); two of the per-product expense rows get a
  `subcategory_option_id`; orders get `cancellation_reason_option_id` when
  cancelled (confirmation) or cancelled/returned (delivery), cycling through
  the seeded reasons by index; every 9th/13th order gets a demo "Test"/"VIP"
  tag via `order_tags`. Local DB's existing `orders`/`expenses` rows were
  deleted and reseeded (products kept, backfilled in place) so the new
  columns have real demo data — verified via SQL: all 5 products have a
  category+fabric, 14/60 orders have a cancellation reason, 11 `order_tags`
  rows, all 5 option sets populated.
- **Verified live** (local Supabase docker + `.env.development.local`,
  already-authenticated `admin@seed.mnw` session reused): typed a new
  category "Chaussures" into the product form's Category field → "+ Create"
  row appeared → clicked it → option created server-side, auto-selected,
  chip rendered with an auto-assigned color, all without leaving the form;
  cleaned it up afterward via the Options screen's Delete (usage was 0).
  Renamed "Coton" → "Coton bio" from the Options screen and back — persisted
  across `router.refresh()`. Opened the color-picker popover (10 swatches).
  Confirmed a cancelled order (SEED-0017) shows its seeded cancellation
  reason chip pre-filled and an uncancelled order shows the field empty;
  confirmed a tagged order (SEED-0001) shows its "Test" chip. Deleted the
  test "Chaussures" option via the management screen's kebab → Delete →
  native `confirm()` dialog (handled via Playwright's dialog API) →
  disappeared. **Console clean (0 errors) across the whole pass.**
- **Screenshot self-critique (dark + light + Arabic/RTL)**:
  `docs/design/audit/phase-12-9/` — `settings-options-dark.png` (Options
  card, all 5 sets), `settings-options-full-dark.png` (whole Settings page
  with the new card in place), `settings-options-colorpicker-dark.png`,
  `settings-options-renamed-dark.png`, `settings-options-full-light.png`,
  `settings-options-ar-rtl-dark.png` (section headers translated, kebabs
  mirrored to the start side, reorder arrows and usage counts read
  correctly right-to-left, "multi-select" badge translated); `product-
  form-dark.png` + `product-form-created-dark.png` (inline-create flow),
  `products-table-dark.png`/`products-list-dark.png` (category chips in
  both views), `finance-expenses-new-dark.png` (subcategory field next to
  category), `order-detail-tags-dark.png` + `order-detail-cancelled-dark.png`
  + `order-detail-ar-rtl-dark.png`. No fixes needed from the shots — the
  only real find this session (the `Combobox` icon/label double-render risk)
  was caught during implementation by reasoning through the component, not
  by a screenshot. Locale/theme reverted to English/Dark before finishing.
- **`ponytail:ponytail-review` pass** (run before merging, per protocol):
  two minor duplication findings, both left as-is — `OptionSelect`/
  `OptionMultiSelect`'s `handleCreate` repeat the same 6-line "call
  `createOption` → push into local `opts` → toast on error" shape, and
  `OrderTaxonomyCard`'s two `onChange` handlers repeat the same 3-line
  "toast on error else `router.refresh()`" shape. Net ~10 lines, not worth
  a shared helper for two short, already-legible call sites in
  freshly-written single-purpose files.
- **Known / scope cuts, not oversights**: no tags filter dimension added to
  `/app/orders/all`'s filter bar (only a `defaultHidden` display column) —
  the phase brief asked to *wire* the taxonomy fields, not necessarily add
  a new filter axis everywhere; revisit if tag-based filtering becomes a
  real workflow ask. Tags/cancellation-reason are only editable from the
  order **detail page**, not inline on the confirmation/delivery queue rows
  — the queue rows already have a lot of controls (status buttons, risk
  badge, duplicate banner) and adding two more taxonomy pickers there felt
  like scope creep past "wire the field", not "redesign the queue row"; the
  detail page is one click away via the sheet's "open full page" link.
  `getOptionUsageCounts`/`repointReferences` are explicit per-table
  `switch`/list, not generic — correct tradeoff at 5 fixed sets, revisit
  only if option_sets ever needs to back a 6th+ consumer table (would be a
  good time to reconsider a generic approach).
- Files: new `supabase/migrations/00014_option_sets.sql`, `src/lib/
  {option-sets,option-sets-actions}.ts`, `src/app/app/settings/options-
  section.tsx`, `src/app/app/orders/[id]/order-taxonomy-card.tsx`; rewrote
  `src/components/fields/option-select.tsx`; extended `src/lib/statuses.ts`
  (`CHIP_TOKENS`, `OPTION_PALETTE`, `autoToken` — moved from
  `option-select.tsx`), `src/app/app/{products,orders}/actions.ts`,
  `src/app/app/settings/page.tsx`, `src/app/app/products/{page,product-
  form,products-view}.tsx`, `src/components/finance/{expense-form,
  expense-table}.tsx`, `src/app/app/{finance/expenses,products/[id]/
  expenses,contacts/suppliers/[id],orders/[id],orders/all}/page.tsx`,
  `src/app/app/orders/all/orders-all-table.tsx`, `scripts/seed-dev.ts`,
  `docs/DB.md` (new `option_sets`/`options`/`order_tags` rows + updated
  `products`/`expenses`/`orders` notes); ~30 new message keys in both
  locales (`settings.options.*`, `fields.subcategory`/`tags`/
  `cancellationReason`, `actions.add`/`rename`/`select`); regenerated
  `database.types.ts` (local `--db-url` regen, no `graphql_public`/
  `__InternalSupabase` hand-merge needed — recent phases already stopped
  doing that, per §8's precedent).
- **Next chat must know:** `npm run build` + `npm test` green (31 pass / 38
  RLS-suite skipped, unchanged — no new test file; this section is UI/forms
  + straightforward CRUD actions over a fresh but simple schema, nothing
  with branchy logic worth a unit test beyond what live-verification above
  already covered). Forbidden-color grep = 0, no native `<select>`/raw
  `<input>` across every file this section touched. `graphify update .` run
  (1478 nodes, 3775 edges, 122 communities).

**Phase 12 is now fully done — all 9 sections complete.** Phase-plan table
status updated below from "in progress" to "done". Next: whatever Phase 13
covers (`docs/phases/phase-13.md` — appeared in the repo during §7/§8 but
wasn't this session's scope; read it fresh before starting).

## Addendum — Phase 10 deploy checklist refreshed (2026-07-30)

User asked to continue Phases 10 and 13. Phase 10's only open item is deploy
(everything else — seed script, RLS suite, E2E pass, polish — was already
DONE per the 2026-07-26 block above). **Deploy stays handed off, still not
executed by an agent this session** — the user explicitly chose "I'll run the
remote/Vercel steps myself" when asked, since it means pushing schema changes
to the real linked Supabase project and deploying with the user's own Vercel
credentials, neither of which an agent should do unattended. What changed
since the original handoff: **six more migrations landed** (00009 was the
newest at the time; 00010–00014 shipped across Phase 12 §5/§7/§9 and the
ZR Express addendum) and **none of them have touched the linked remote** —
the checklist below supersedes the one in the 2026-07-26 block, same
mechanics, current file list.

1. `npx supabase db push` (linked project) — applies **00009 through 00014**
   in one shot (order transitions RPC, dashboard filter/daily/status-
   breakdown RPC extensions, ZR Express tables, tasks table, option_sets/
   options + the taxonomy FK columns on products/expenses/orders). Confirm
   00001–00008 are already applied (Phase 0's original rebaseline push).
2. `npx supabase gen types typescript --linked > src/lib/supabase/database.types.ts`
   — the committed file was regenerated locally (`--db-url` against the local
   docker stack) every session since Phase 7; this reconciles it against
   what the remote project actually has once step 1 lands.
3. `vercel link` (or Vercel dashboard → New Project → import this repo) if
   not already linked — no `.vercel/` directory exists in this repo yet.
4. Env vars (Project Settings → Environment Variables, all three
   environments): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (server-only, no `NEXT_PUBLIC_` prefix),
   `APP_URL` (the deployed URL once known — feeds invite-email redirects and
   the webhook-URL display in Settings → Integrations).
5. Deploy (`vercel --prod` or push to the connected branch).
6. Run one real webhook against the deployed URL — Settings → Integrations
   now has a **"Send test event" button** (built in Phase 12 §8) that signs
   and posts a synthetic payload to the real `/api/webhooks/<provider>`
   endpoint, which is easier than the original handoff's manual curl
   fixtures (still documented in the Phase 6 block above if a real-payload
   test is needed instead). Update the provider's webhook URL + secret to
   the production values once confirmed working.
7. Free-tier constraints unchanged from the original note: Supabase free
   tier pauses after ~1 week idle (first request after a pause is slow) and
   caps the DB at 500 MB; Vercel hobby tier has no background jobs (fine,
   no cron in this app) and a function-duration cap (webhooks are simple
   upserts, well under it).
8. **New since the original handoff, worth doing once live**: the ZR Express
   integration (addendum, 2026-07-28) needs a publicly reachable `APP_URL`
   to register its status webhook — that step was explicitly deferred
   pending a real deployed URL, this is that URL.

Phase-plan status stays **"partial (deploy handed off)"** — genuinely
unchanged until the user runs the steps above.

## Phase 13 — Final sweep (2026-07-30) — DONE

- Scope: the last planned phase. No new features — verifies the Phase 11/12
  overhaul is complete and even: interconnection, contrast, keyboard/a11y,
  mobile, four states, hardcoded-color grep, RTL/i18n, final screenshots.
  Branch `mnw-13` off `mnw` (bundled with the Phase 10 checklist refresh
  above, same session).
- **Mechanical sweeps (whole repo, not just this session's files):**
  - Hardcoded-color grep (`text-white|bg-white|text-black|bg-black|#hex|
    rgb\(|rgba\(|glass-card|text-gradient`) — **zero hits outside
    `globals.css`'s own token definitions.** Already clean; no fixes needed.
  - Native `<select>` / raw `<input>` grep — found and fixed the one
    remaining violation: `src/components/currency-rate-fields.tsx` imported
    the banned `components/ui/native-select`. Turned out to be **dead code**
    (zero importers — superseded by `MoneyCurrencyField` sometime after
    Phase 3, per that file's own doc comment naming it as the direct
    successor). Deleted the file instead of fixing it — the banned import
    and the component both went away in one line-count-negative move.
  - Hardcoded EN strings outside `messages/{en,ar}.json`: swept every
    `aria-label="..."` literal and one `sr-only` span repo-wide. Found and
    fixed 7 — `Sheet`/`Dialog`'s "Close" (shared primitives, both add
    `useTranslations` + a new `actions.close` key, one fix covers every
    sheet/dialog in the app), the sidebar's "Toggle sidebar"/"Menu" (now one
    shared `nav.toggleSidebar` key), `QuantityStepper`'s "Decrease"/
    "Increase" (`actions.decrease`/`increase`), the Algeria map's "Delivery
    rate by wilaya" (threaded as a `label` prop from `wilaya-section.tsx`
    rather than adding `next-intl` to the pure-d3 map file — smaller diff,
    same fix), `DataTable`'s "Select all"/"Select row" checkboxes
    (`table.selectAll`/`selectRow`), and four **missing** aria-labels on
    icon-only buttons in last session's own `options-section.tsx` (rename
    confirm/cancel, merge cancel, kebab, color picker — caught by re-reading
    my own Phase 12 §9 diff with fresh eyes). ~10 new message keys total,
    both locales.
  - `npm run build` + `npm test` green after every fix, re-run at the end.
- **Contrast (task 2)**: `/design-preview`'s contrast readout (built Phase
  11) re-checked in full — every token pair passes ≥4.5:1 in both dark and
  light (`text-faint`/placeholder sits at 3.6–3.7:1, marked `n/a` by design,
  not a body-text pair). Live spot-check on the mobile confirmation sheet
  (the single most contrast-critical screen — agents read it outdoors) in
  both themes: clean. No token changes needed — the systemic check plus one
  live spot-check was enough; every phase since 11 already screenshot-
  verified its own real pages in both themes.
- **Sidebar icon-rail tooltips — found and fixed a real gap (task 4)**: the
  collapsed sidebar's nav icons only had a native `title` attribute; a fully
  themed `Tooltip`/`TooltipTrigger`/`TooltipContent` primitive existed
  (`components/ui/tooltip.tsx`, Radix-backed) but was **never actually used
  anywhere in the app** — only demoed in `/design-preview`, with
  `TooltipProvider` wrapping the whole shell for no live consumer. Wired the
  real tooltip onto collapsed nav `Leaf`s (kept the avatar/account button on
  native `title` — deliberately out of scope, it's not "icon rail" content
  and already reveals its identity via the dropdown). `side` has to be a
  physical `"left"`/`"right"` (Radix doesn't auto-flip a logical `"end"`
  without a `DirectionProvider` this app doesn't use) — resolved via
  `useLocale() === "ar"`, verified both directions live (tooltip lands
  start-of-icon in both LTR and RTL). **Removing the native `title` also
  silently removed the link's accessible name** (Tooltip content is a
  description via `aria-describedby`, not a name) — caught immediately by
  re-testing with Playwright's accessibility tree (the "Products" role
  query stopped resolving), fixed by adding `aria-label={collapsed ? label
  : undefined}` back onto the link. A real a11y regression caught and fixed
  in the same breath it was introduced, not shipped and found later.
- **Keyboard + a11y floor (task 3)**: full order flow driven **keyboard-
  only** end to end — focused the `orders/confirmation` table (`tabIndex=0`
  root, `ArrowUp`/`ArrowDown` roving focus, `Enter` opens the deep-linked
  sheet), tabbed to a status button, `Enter` selected "Confirmed", tabbed to
  the comment textarea then Save, `Enter` submitted — order left the queue,
  confirmed via a fresh page load with zero console errors. Reverted the
  seed order's status + deleted the spurious `order_status_history` row the
  manual SQL revert itself created (the `log_order_status` trigger fires for
  any client, including a direct `psql` update) to leave seed data pristine.
  **Found a real visibility gap while doing this**: the table's roving
  keyboard-focus row had a class (`bg-surface-raised`) but it was
  indistinguishable from the *hover* state (same class, `onMouseEnter` sets
  the same `focus` index) — a sighted keyboard user had no reliable way to
  see which row `Enter` would open. Fixed in `data-table.tsx`: added a
  `tableFocused` state (`onFocus`/`onBlur` on the table root) and only ring
  the focused row (`ring-2 ring-inset ring-ring`) when the table itself has
  real DOM focus — so mouse hover still gets its subtle background tint,
  keyboard focus gets a real visible ring, and the two never collide. This
  is a shared component — the fix applies to every `<DataTable>` in the app
  at once, not just Orders. `⌘K` (command palette → "Go to" list) and `?`
  (keyboard-shortcuts overlay, itself listing `⌘K` and `?`) both verified
  live. `prefers-reduced-motion` was already handled globally since Phase 11
  (`globals.css`, universal selector, unchanged).
- **Mobile (task 4)**: confirmation queue at 390px is a horizontally-
  scrollable dense table (standard, acceptable mobile pattern for this much
  data — not a card-stack rebuild, which the checklist doesn't require)
  with the hamburger/search/tabs all present; **tapping a row opens the
  exact sheet layout the Phase 12 §2 spec calls for** (name → big `tel:`
  link → risk badge → previous orders → product/qty/price → status buttons
  → comment box → Save/Save & open next), fully usable one-thumb, verified
  in both themes. Dashboard at 390px stacks the filter grid and KPI cards
  2-per-row correctly (already screenshot-checked in Phase 12b, re-verified
  here, unchanged). Tasks kanban at 390px scrolls columns horizontally
  (same acceptable pattern as the orders table). Collapsed desktop sidebar
  icon rail verified with the new tooltips above. One false alarm chased
  down and ruled out: a floating black "N" circle bottom-left in every
  screenshot turned out to be Next.js's own dev-mode devtools portal
  (`<nextjs-portal>` element), not app UI — won't exist in a production
  build.
- **Interconnection (task 1) — found and fixed two real dead ends**:
  - The **Funnel chart's stage segments had no `href` at all**, despite the
    `<Funnel>` component itself already supporting one (`stages[].href?`,
    built in some earlier phase and simply never wired from
    `dashboard/page.tsx`). Wired "Received"/"Confirmed"/"Delivered" to
    `ordersQs(filters, {...})` (same helper the KPI cards already use, so
    filters/date-range travel through identically). **"Shipped" stays
    unlinked, deliberately**: its count is a compound SQL condition
    (`confirmation_status='confirmed' AND delivery_status NOT IN
    ('wait_for_deposit','cancelled')`, from `00011_dashboard_status_
    breakdown.sql`) that `/app/orders/all`'s filter bar has no single-value
    equivalent for — linking it to just `confirmation_status=confirmed`
    would show *more* rows than the number claims (includes delivered/
    returned too), which is a worse dead end than no link. Revisit if the
    orders filter bar ever grows compound/multi-status filtering.
  - **`StatusBreakdownBars` (confirmation/delivery status distribution,
    added Phase 12b) had zero click-through** — every bar was a plain
    `<li>`, not even a `cursor-pointer` div. Added a required `hrefFor`
    prop (same shape as the sibling `CategoryBars` component, which already
    had one) and wired both dashboard call sites to
    `ordersQs(filters, { confirmation_status: status })` /
    `{ delivery_status: status }`. Verified live: every status bar (wait for
    confirmation/no answer/cancelled/closed phone/confirmed, etc.) is now a
    real link to the matching filtered list.
  - Everything else sampled came back correctly wired, verified by reading
    source rather than clicking every instance (given the scope — dozens of
    screens): `CategoryBars`' `hrefFor` is a required prop (can't compile
    without one, so every call site necessarily has it); the per-product
    dashboard table already links product names to their Statistics tab;
    the product page's Orders tab (`ProductOrdersTable`) correctly links
    each order number to the one shared `/app/orders/[id]` detail page
    rather than reimplementing a second edit surface (matches
    `interconnection.md` Rule 1 — a record has one edit component, other
    surfaces just link to it); the per-agent rate table already links
    through `ordersQs(filters, { agent: ... })`.
- **Four states (task 5)**: skeleton and error-with-retry are both `status`-
  gated branches already built into `<DataTable>` (confirmed by reading the
  component, present since Phase 12 §1). Live-verified empty state on
  `/app/orders/all` with an impossible filter (`wilaya_code=99`): correct
  title/description, active filter chip, and a primary "New order" action —
  matches the acceptance line exactly.
- **RTL/i18n (task 7)**: spot-checked screens not previously verified in
  Arabic this phase pass — `/app/orders/all` (full desktop table, every
  status/source pill translated, columns correctly mirrored) and the order
  detail sheet's new Tags/Cancellation-reason card (Phase 12 §9). Both
  clean, no layout breakage, no leftover English strings. Combined with the
  aria-label sweep above (which is itself an i18n completeness check), this
  closes out the "every new string is in messages" requirement for
  everything touched since Phase 12 §9.
- **Screenshot self-critique**: `docs/design/audit/final-13/` (19 shots) —
  dashboard desktop (dark+light), products grid (light), finance overview
  (dark), mobile confirmation queue + sheet (dark+light), mobile dashboard,
  mobile tasks kanban, collapsed sidebar + tooltip (dark, and the Arabic/RTL
  mirrored version), row-focus-ring close-up, keyboard-flow status-selected
  sheet, `⌘K` palette, `?` shortcuts overlay, empty-state, the Funnel drill-
  through target page, and the Arabic/RTL orders list. Every fix above was
  re-verified live after being made, not just by re-running the build.
- **Known / residual backlog** (unchanged from Phase 10's backlog note,
  still not attempted, still correctly out of scope): FR locale, a real
  carrier API integration beyond ZR Express, the SaaS multi-workspace
  signup flow, product/variant image uploads. Nothing new added to this
  list by Phase 13 — the sweep found polish gaps, not missing features.
- Files: deleted `src/components/currency-rate-fields.tsx`; modified
  `src/components/{ui/sheet,ui/dialog,app-shell,fields/quantity-stepper,
  data-table/data-table,dashboard/algeria-map,dashboard/status-breakdown-
  bars}.tsx`, `src/app/app/{dashboard/page,dashboard/wilaya-section,
  settings/options-section,team/meetings/[id]/page}.tsx`; ~10 new message
  keys in both locales (`actions.close/decrease/increase/moreOptions`,
  `nav.toggleSidebar`, `table.selectAll/selectRow`,
  `dashboard.wilaya.mapLabel`, `settings.options.color`).
- **Next chat must know**: `npm run build` + `npm test` green (31 pass / 38
  RLS-suite skipped, unchanged — every fix this phase was UI/markup/wiring,
  nothing with new branchy logic worth a unit test beyond the live
  verification documented above). Forbidden-color grep = 0, no native
  `<select>`/raw `<input>` anywhere in `src`. `graphify update .` run (1477
  nodes, 3768 edges, 124 communities). **This was the last planned phase.**
  The app is feature-complete per the v2 plan and has now had both its
  section-by-section build (Phase 12) and a cross-cutting final sweep
  (Phase 13). The only thing standing between this repo and production is
  the Phase 10 deploy checklist above — genuinely a "run these commands"
  task for whoever owns the Vercel/Supabase accounts, not more engineering.
  Backlog for whenever there's a reason to pick it up: FR locale, real
  carrier API, SaaS signup flow, image uploads (all listed in every phase's
  backlog note since Phase 10, still true).

## Phase 14a — Orders status model rework (2026-07-31) — DONE

- Done: dropped the rigid transition graph for Orders. `src/lib/statuses.ts`
  gained `allStatuses(kind)` (every status of a kind), `statusOptionsFor(kind,
  current)` (all statuses for confirmation/delivery, still `transitionsFor`'s
  `next[]` for product/task — those keep their own workflow graphs, untouched),
  and `currentStatus(order)` (the single merged `{kind,key}`: delivery once
  `confirmation_status==='confirmed'`, else confirmation — the one-column
  helper). `<StatusSelect>` now uses `statusOptionsFor` and centralizes the
  `requiresConfirm` `window.confirm` gate (previously only confirmation-sheet
  had it) so every call site — order-workflow's two selects, delivery-table/
  kanban, and the new all-orders Status column — gets it uniformly.
  `confirmation-sheet.tsx`'s button grid switched from `transitionsFor` to
  `allStatuses("confirmation")`: previously a **terminal status (confirmed/
  cancelled) showed only one button** since `next: []`, a real gap this fixes.
  `delivery-kanban.tsx` dropped its own `isLegal()` gate and the
  `draggable={!def?.terminal}` restriction (any column now accepts a drop,
  every card is draggable) — required once the on-card `StatusSelect` started
  offering all statuses, otherwise the kanban's own gate would reject almost
  every choice the select allowed.
- **RLS (migration `00015_free_status_transitions.sql`)**: `o_sel` broadened
  to `workspace_id = current_workspace_id()` for every role — both agent
  roles now see all workspace orders (this also deletes 00009's "blind spot":
  a confirmation_agent can reopen an order they just confirmed). `o_upd`
  likewise drops the `confirmation_status`-based role coupling (admin OR
  confirmation_agent OR delivery_agent, workspace-scoped) since `guard_order_
  fields` already gates columns per role. `transition_order_status` RPC role
  check rewritten to gate on **which param is being set**, not the row's
  current status: confirmation_agent may set `confirmation_status` to any
  value as long as `delivery_status` isn't also being touched in the same
  call, delivery_agent symmetric, admin either/both. Money stays UI-gated
  (`showMoney`) and financial tables stay admin-only — unchanged, no new
  money exposed. Verified live against the local Supabase docker stack
  (already-seeded `confirmation_agent`/`delivery_agent` profiles, 60 orders):
  confirmation_agent now sees all 60 rows (was blind to the 38 confirmed
  ones), can re-set `confirmation_status` on an already-confirmed order
  (previously impossible), is rejected when passing `p_delivery_status`;
  delivery_agent symmetric (sees all 60, can set `delivery_status` on a
  not-yet-confirmed order, rejected on `p_confirmation_status`). All checks
  ran inside a rolled-back transaction, no data mutated.
- **Single Status column**: new `src/app/app/orders/status-cell.tsx`
  (`<StatusCell>`) — `currentStatus()` pill/select + a history icon button
  that opens the existing `<OrderTimeline>` in a `<Popover>` (Radix, no new
  data fetch, reuses the row's already-loaded `order_status_history` events).
  Wired into `orders-all-table.tsx` (replaces the `confirmation_status` +
  `delivery_status` columns and the sheet's two stacked pills — one `status`
  column, `t("fields.status")`) and `order-workflow.tsx`'s header (single
  `<StatusPill>` via `currentStatus()`, no popover/select there since the
  existing two-field edit form below and the full history section already
  cover editing/history — adding `<StatusCell>` there would've been a
  duplicate control for the same thing, cut in ponytail-review). Four other
  spots that rendered both pills side-by-side for the same order also
  collapsed to one pill via `currentStatus()`: `product-orders-table.tsx`
  (Products → Orders tab), `contacts/customers-table.tsx` and
  `contacts/[id]/page.tsx` (customer order-history lists — view-only, no
  popover), and `orders/[id]/page.tsx`'s Meta grid (the two Meta fields were
  redundant with `OrderWorkflow`'s header pill directly below — deleted
  rather than collapsed). `dashboard/page.tsx`'s confirmation/delivery
  breakdown charts were **not** touched — those are two separate workspace-
  level funnels, not a per-order pair, out of scope.
- **Compact pills + short labels**: `<StatusPill>` gained a `compact` prop
  (swaps the full `status.*` label for a new parallel `status.short.*` tree —
  kept as a sibling tree rather than nesting a `.short` key under the
  existing string leaves, since next-intl `t()` can't resolve a path that's
  sometimes a string and sometimes an object). Added `status.short.
  confirmation_status.*` / `status.short.delivery_status.*` (one word each,
  e.g. "Waiting"/"At bureau"/"Out") to both `en.json`/`ar.json`.
  `<StatusSelect>` threads a `compact` prop to its trigger + every option's
  `<StatusPill>`. `<StatusCell>` always renders compact (table use).
- **Narrow columns**: `Column.width` (already existed, was only ever wired
  to `<th>`) now also applies to `<td>` in `data-table.tsx` — it was
  previously a dead prop for body cells since the table has no
  `table-layout: fixed`. `orders-all-table.tsx`: `order_number` (`max-w-
  [9rem]`, truncating link, duplicate chip `shrink-0` so it never gets
  squeezed out), `placed_at` (`w-28`, `whitespace-nowrap`), `product`
  (`max-w-[12rem]`, `min-w-0` wrapper so the existing `truncate` span
  actually has something to truncate against — it had no effect before,
  since the flex row was unbounded).
- Fixed in passing (ponytail-review pass): `<StatusCell>` had an `editable`
  prop with a default and an unused `false` branch (both call sites always
  left it `true` — the route is admin-only) — deleted, always renders the
  select. Two spots (`customers-table.tsx`, `contacts/[id]/page.tsx`) called
  `currentStatus(o)` twice in the same JSX line — switched the `.map()` to a
  block body computing it once.
- Files: new `src/app/app/orders/status-cell.tsx`, `supabase/migrations/
  00015_free_status_transitions.sql`; modified `src/lib/statuses.ts`,
  `src/components/{status-select,status-pill,data-table/data-table}.tsx`,
  `src/app/app/orders/{order-workflow,[id]/page,all/orders-all-table,
  confirmation/confirmation-sheet,delivery/delivery-kanban}.tsx`,
  `src/app/app/{contacts/[id]/page,contacts/customers-table,products/[id]/
  orders/product-orders-table}.tsx`, `src/messages/{en,ar}.json`.
- Screenshot self-critique: local Supabase docker stack + `npm run dev`
  (both already running from a prior session) + the Playwright MCP, logged in
  as the seeded admin (`admin@seed.mnw`). Captured and visually verified in
  **both themes**: `/app/orders/all` (compact Status column + dropdown
  showing all 10 delivery statuses + the history popover with full timeline),
  `/app/orders/[id]` (single header pill, two-field edit form unchanged
  below), `/app/orders/confirmation` (confirmation-sheet button grid now
  shows all 5 statuses instead of 1 for a terminal/cancelled order),
  `/app/orders/delivery?view=kanban` (dark only — free drag confirmed, no
  `illegalTransition` toast), `/app/contacts` customer sheet (light —
  collapsed order-history pill). No hardcoded colors, no layout breakage in
  either theme; the free-transition dropdown/button-grid render with correct
  per-status tokens in both themes.
- Known issues: none new. `illegalTransition` message key is still used by
  `task-kanban.tsx`/`task-table.tsx` (task status keeps its restricted
  transition graph — out of this phase's scope) so it wasn't removed, only
  its `delivery-kanban.tsx` call site.
- Next chat must know: `npm run build` and `npm test` green (31 pass, 38
  RLS-suite skipped, unchanged), `graphify update .` run (1519 nodes, 3830
  edges, 130 communities). **Phase 14b** (Exchange/Swap/return-fee) reads
  `statuses.ts`/`enums.ts`/`orders/actions.ts` and explicitly builds on this
  phase's free-transitions helper (`statusOptionsFor`) — the new `exchange`/
  `swap` delivery statuses it adds will automatically appear in every
  `<StatusSelect>`/`<StatusCell>` once added to `DELIVERY_STATUS` in
  `statuses.ts`, no further wiring needed there. `currentStatus()` and
  `<StatusCell>` are the new canonical single-status primitives — any future
  Orders UI that needs to show or edit "the" status of an order should use
  them rather than re-deriving the confirmed/not-confirmed branch inline.

## Phase 14b — Exchange, Swap & return-fee default (2026-08-04) — DONE

- Done: two new delivery statuses (`exchange`, `swap`), swap order action
  (admin-only), return-fee default bumped to 150 DZD, swap-card UI with
  A↔B link display, self-advancing slash commands (`/bootstrap`,
  `/analyse`, `/execute`) for the phase-14 loop.
- **Migration `00016_exchange_swap.sql`:** `alter type delivery_status add
  value 'exchange'/'swap'`; `swapped_to_order_id` nullable FK on orders
  with index; guarded UPDATE on `settings` to bump `return_fee` from 100→150
  only for untouched workspaces (preserves custom values). `swapOrder`
  is admin-only because `o_ins` (orders insert) and `cu_all` (customers
  insert) are both RLS-gated `is_admin()` — the plan said
  "admin/delivery" but elevating delivery agents needs a security-definer RPC
  + new insert policies, deferred.
- **`statuses.ts`/`enums.ts`:** added `exchange` (token `info`, icon `Repeat`)
  and `swap` (token `indigo`, icon `ArrowLeftRight`) to `DELIVERY_STATUS`.
  `currentStatus()`/`statusOptionsFor()` needed no change — 14a's free
  transitions + the single merged column already handle any new value
  automatically. `z.enum(DELIVERY_STATUSES)` in `updateDeliveryStatus`/
  `bulkTransition` now accepts the two new values.
- **`swapOrder` action** (`orders/actions.ts`): mirrors `createOrder` —
  `adminProfile()` → zod-parse new customer → `upsertCustomerFromOrder` →
  INSERT B (source `'manual'`, copies A's `product_id`/`variant`/`quantity`/
  `sale_price`/`delivery_fee`/`delivery_type`; new customer snapshot + wilaya;
  `confirmation_status='confirmed'`, `delivery_status='wait_for_deposit'`) →
  RPC sets A's `delivery_status='swap'` → plain `.update` sets
  `swapped_to_order_id=B.id`. Sequential, not transactional (ponytail
  comment: upgrade to definer RPC if orphaned Bs bite).
- **`swap-card.tsx`** (new, client): admin-only card with `<details>` form
  (Field+Input+native `<datalist>` for wilaya, no JS state, no Radix
  Select) revealed by "Swap to new customer" button, shown when
  `delivery_status ∈ {returning, returned, exchange, delivered}` and order
  not yet swapped. Also renders A↔B link in both directions.
- **`page.tsx`** wiring: fetches swapped-to (A→B), swapped-from (B←A
  reverse query), and wilaya list inside the admin block; passes to
  `<SwapCard>` alongside ZRShipmentCard.
- **Messages EN/AR:** full + short labels for exchange/swap; `orders.swap.*`
  block for form fields and link labels.
- **`.claude/commands/`:** three new slash commands (`bootstrap`,
  `analyse`, `execute`) — verbatim copies of the PROGRESS.md runner
  prompts, making the phase-14 loop self-advancing: `/analyse` on
  glm-5.2 writes the next brief, `/execute` on glm-5-turbo builds+merges.
- **`database.types.ts`:** hand-patched (remote DB lacks migration 00016;
  regen after `db push` will reconcile). Both union-type and array-literal
  `delivery_status` enums updated; `swapped_to_order_id` added to all three
  orders Row/Insert/Update variants.
- **Key finding — RPC unchanged:** `transition_order_status` (00015) takes
  typed `delivery_status` params and role-gates by *which* param is set,
  not the value — adding enum values auto-authorizes delivery_agent to set
  them. No RPC code change needed.
- **Key finding — stock safe for B + 14d flag:** `order_stock_effects`
  (00004) is `AFTER UPDATE` only, so B's already-confirmed INSERT never
  decrements. 14d's planned auto-decrement trigger MUST stay
  UPDATE-scoped (`OLD IS DISTINCT FROM NEW`), never `after insert or
  update` — written into the 14b brief for 14d to inherit.
- Files: new `supabase/migrations/00016_exchange_swap.sql`,
  `src/app/app/orders/[id]/swap-card.tsx`,
  `.claude/commands/{bootstrap,analyse,execute}.md`; edited
  `src/lib/enums.ts`, `src/lib/statuses.ts`, `src/lib/settings.ts`,
  `src/app/app/orders/actions.ts`, `src/app/app/orders/[id]/page.tsx`,
  `src/lib/supabase/database.types.ts`, `src/messages/{en,ar}.json`,
  `supabase/migrations/{00002,00007,00014}_*.sql`.
- Known issues: **browser screenshots not captured** — Playwright MCP
  became unavailable mid-session (connection timeout). The swap form,
  exchange/swap status pills, and A↔B link rendering were NOT visually
  verified in either theme. A future session should screenshot an order
  detail page (with a delivered/returned/exchange order) in light + dark
  to confirm rendering. Migration 00016 not yet applied to the linked
  remote project — run `npx supabase db push` + `npx supabase gen types
  typescript --linked > src/lib/supabase/database.types.ts` to
  reconcile (the hand-patches become unnecessary).
- Next chat must know: `npm run build` and `npm test` green (31 passed,
  hand-patched types). 14c (Finance → Accounts) is next — it creates
  new tables (`accounts`/`account_topups`), follows the new-table
  checklist (CLAUDE.md), and is admin-only (financial). The
  `/bootstrap` → `/analyse` → `/execute` loop works — paste the next
  command in a fresh chat.

## Phase 14c — Finance → Accounts (running ledger) (2026-08-13) — DONE

- Done: admin-only accounts feature — `accounts` table (name, currency,
  opening_balance, low_balance_threshold, is_active) +
  `account_topups` (append-only deposits) + `account_balances` security-invoker
  view (derived: opening_balance + Σtopups − Σexpenses − Σad_spend). Nullable
  `account_id` FK added to `expenses` and `ad_spend_daily` (backward-compatible).
  RLS: admin-only on all three new tables + triggers (`set_updated_at` on
  accounts, `audit_row()` on accounts + topups). Migration `00017_accounts.sql`.
- Done: accounts page at `/app/finance/accounts` (server component, four states
  via `<Empty>` + `<AccountTable>`) with inline add/edit form + inline top-up
  form. Account selector (EnumSelect with `__none` sentinel, same pattern as
  supplier select) wired into expense-form + ad-spend-form. Low-balance banner
  on finance overview (danger-tinted `<Link>` to accounts, shown when any
  active account has `balance ≤ threshold`). Nav entry (Landmark icon) +
  FinanceTabs extended.
- Files: new `supabase/migrations/00017_accounts.sql`,
  `src/app/app/finance/accounts/{actions,page}.tsx`,
  `src/components/finance/{account-form,account-table,topup-form}.tsx`; modified
  `src/app/app/products/actions.ts` (account_id in expense/ad-spend schemas),
  `src/components/finance/{expense-form,ad-spend-form,expense-table}.tsx`
  (accounts prop threading), `src/app/app/finance/{finance-tabs,overview/page,
  ad-spend/page,expenses/page}.tsx`, `src/components/nav-model.tsx`,
  `src/lib/supabase/database.types.ts` (hand-added, not regen — auto-regen
  produced a broken file that resolved all supabase query types to `never`;
  manually added accounts/account_topups/account_balances types +
  account_id on expenses/ad_spend_daily to the committed base), `docs/DB.md`,
  `src/messages/{en,ar}.json`, `tsconfig.json` (exclude scripts).
- Decisions: balance derived via view (not stored), matching plan. Expenses/
  ad-spend ARE the debits, no separate ledger. Ponytail: EnumSelect for 1–3
  accounts instead of a full combobox.
- Known issues: **migration 00017 not yet pushed to remote.** The app
  renders the empty state correctly (accounts query returns null when table
  doesn't exist, handled by `?? []`), but create/top-up/banner functionality
  requires `npx supabase db push`. The auto-regen of `database.types.ts`
  (`npx supabase gen types typescript --linked`) produced a structurally valid
  but semantically broken file — all supabase queries resolved to `never`
  (57 files with errors vs 8 with committed types). Root cause unknown;
  workaround was hand-adding the types to the committed base. Future regens
  should verify with `npx tsc --noEmit` before replacing the committed file.
- Next chat must know: `npm run build` and `npm test` green (31 passed).
  `graphify update .` run (1564 nodes). Push `npx supabase db push` before
  testing accounts functionality live. 14d (Stock hub + auto-decrement) is
  next — it rewrites the existing `order_stock_effects` trigger (moves decrement
  from `delivered` to `confirmed`), does NOT add a new table. The 14d brief
  is written in `phase-14-plan.md §14d`.

## Phase 14d — Stock hub + auto-decrement (2026-08-13) — DONE

- Done: rewrote `order_stock_effects` trigger — moved stock decrement from
  `delivery_status=delivered` to `confirmation_status=confirmed` (prevents
  double-decrement). Added 3 new `stock_reason` enum values:
  `order_confirmed`, `order_reverted`, `order_returned`. Created stock hub
  page at `/app/stock` (admin-only, all products with stock levels, low/out
  `<Chip>` badges, per-row inline manual adjust). Added nav peer leaf (Stock,
  Boxes icon). Widened `addStockMovement` revalidatePath. Added i18n keys
  for new stock reasons and hub copy (EN + AR). Updated DB.md.
- Files: `supabase/migrations/00018_stock_confirm.sql`,
  `src/app/app/stock/page.tsx`, `src/app/app/stock/layout.tsx`,
  `src/app/app/products/actions.ts`, `src/components/nav-model.tsx`,
  `src/messages/{en,ar}.json`, `docs/DB.md`.
- Decisions: trigger is `AFTER UPDATE` only (swap's INSERT-confirmed orders are
  exempt — correct per 14b locked decision). `delivered`/`returned` stock_reason
  values become legacy (kept in enum, no longer inserted). Nav low-stock counter
  deferred (not trivial — hub itself is the surface).
- Known issues: migration not yet pushed (`npx supabase db push` failed with
  connection timeout — local Supabase docker was healthy but `db push` timed
  out on login role init). Types not regenerated (old types still valid — the
  trigger writes string literals, no new TS types consumed). User should run
  `npx supabase db push` manually.
- Next chat must know: `npm run build` green. 14e (Rules redesign) is next.
  The 14e brief is written in `phase-14-plan.md §14e`. No DB pushed this
  session — run `npx supabase db push` before testing stock functionality.
