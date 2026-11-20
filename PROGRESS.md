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
| 14e — Rules redesign | docs/phases/phase-14-plan.md §14e | done |
| 14f — Users + Audit → Settings | docs/phases/phase-14-plan.md §14f | done |
| 14g — Analytics: delivery rate + timing stats (+ PRICING_AND_RISK.md) | docs/phases/phase-14-plan.md §14g | done |
| 14h — Google Drive + Calendar (OAuth) | docs/phases/phase-14h-google-oauth.md | planned (needs user GCloud setup) |
| 15a 🛡️ Security hardening (OWASP) | docs/phases/phase-15-plan.md §15a | done |
| 15b 💰 One money model (pnl_summary + unit economics) | docs/phases/phase-15-plan.md §15b | done |
| 15c 🧭 Shell, nav, formatters, date picker, 4 states | docs/phases/phase-15-plan.md §15c | done |
| 15d 📊 Dashboard rebuild | docs/phases/phase-15-plan.md §15d | done |
| 15e 🛒 Orders & queues | docs/phases/phase-15-plan.md §15e | done |
| 15f 🚚 ZR Express ready-to-link | docs/phases/phase-15-plan.md §15f | done |
| 15g 📦 Products, pricing, stock | docs/phases/phase-15-plan.md §15g | done |
| 15h 💼 Finance | docs/phases/phase-15-plan.md §15h | done |
| 15i ⚙️ Settings, contacts, team polish | docs/phases/phase-15-plan.md §15i | done |
| 15j ✨ Final sweep | docs/phases/phase-15-plan.md §15j | done |


> History for phases 0–15j (3,000+ lines) lives in `docs/PROGRESS_ARCHIVE.md` — don't read it unless a task points at a phase.

## Launch push — Truth pass (2026-10-21) — IN PROGRESS
- Baseline: `npm test` 43 pass / 40 skipped (RLS tests need local Supabase), `tsc` clean, `npm run build` green. Branch `mnw`, 104 commits ahead of origin/mnw (unpushed).
- Secret audit: unpushed commit e686c83 had added `kimi.tx` (live-looking API key) + debug zip. Scrubbed from ALL local refs with git-filter-repo (user-approved); backup bundle outside repo (`~/mnw-erp-backup-*.bundle`, contains the key — delete after rotating) and tag `backup/pre-scrub-abc91cc`. origin/main already carries an old Lovable `.env` (publishable/anon keys only). Demo JWTs in docs/tests are Supabase public demo keys. **Owner: rotate the tokenrouter/kimi key (it was also displayed in an agent transcript).**
- Workflow decision: only bootstrap/analyse/execute commands exist (Phase-14-specific). Verify = independent QA/security agent review; Ship = build+test+secret scan+push, both inline, no new skill files.
- Origin remote re-added after filter-repo; upstream tracking must be re-set on first push.

## P0-1 Webhook hardening (2026-10-21) — DONE (branch mnw-p0-1-webhooks)
- Done: missing signature → 401 and oversized content-length → 413 before any body read/DB write; unsigned/bad-signature/unconfigured requests store no `webhook_events` row; DB write failure → 500 (provider retries, event left unprocessed), mapping/validation failure → 200 (admin replay); redelivery/replay is fill-only (never overwrites non-null admin-edited columns; `delivery_fee_source` follows a filled fee).
- Verify: independent agent review; fixed fee-source provenance + retryable events marked processed. Accepted: concurrent first-delivery race returns 500 then converges on retry (extra event row); chunked bodies without content-length are still read before the size check; ZR endpoint still stores rejected rows (separate path, out of scope); no replay window (Shopify sends no timestamp).
- Evidence: tsc clean, build green, 85/85 tests with local Supabase (2 new early-reject tests). Missing: mocked-DB tests for 500/200 split and fill-only (follow-up).
- Next: D8 agent permission matrix + migration.

## ZR audit + addendum plan (2026-10-21) — DONE (docs) / P0-4 Permission matrix — DONE locally (branch mnw-p0-4-perms)
- ZR: official docs read (docs.zrexpress.app); `docs/ZR_EXPRESS_API_AUDIT.md`. Customer reliability % NOT in the API; collections = states livre→encaisse→recouvert + SupplierPayment/treasury-transactions; balance field semantics undocumented. Plan/decisions D9–D12 updated; D12 owner default (encaisse+recouvert) applied per "do the recommended". `scripts/zr-probe.ts` (read-only) awaiting owner run.
- P0-4: migration `00025_agent_permission_matrix.sql` (queue-scoped o_sel/o_upd, column allow-list guard default-deny, handed-to-delivery lock on every path, transition RPC with queue/zr checks + auto-assign, delivery_agent read-only). Applied to LOCAL DB only — must be included in the owner's `db push` (00020→00025).
- Verify: independent adversarial review found HIGH (direct PATCH bypassed RPC-only shipped/ZR lock) → fixed in trigger + test. Earlier own test run caught a NULL-logic hole and a `text[] || literal` bug.
- Evidence: tsc clean, build green, 89/89 tests with local Supabase (was 85; +8 new, 3 retired). 
- Known: UI still lists delivery_agent role and some agent pages now show narrower counts (browser check pending); `logConfirmationAttempt`/cancel-reason on shipped orders now error (UI should hide them — ZR-2); direct PATCH status churn on open unassigned orders skips self-assign (accepted).
- Next: P0-3 ZR test seam + orphan-parcel fix.

## P0-3 ZR test seam + orphan-parcel fix — DONE locally (branch mnw-P0-3, push gated)
- Done: `ZR_API_BASE` seam; any `*.zrexpress.app` host reachable only when NODE_ENV=production and (Vercel production, or off-Vercel `ZR_ALLOW_PROD=1`) (D13); redirects refused; orphan parcel recovered by externalId lookup before re-insert.
- Verify: qa-reviewer /verify passed twice (full diff, then delta); all findings fixed.
- Evidence: gate OK (tsc, 104/104 tests with local Supabase, build, secret scan).
- Open: live-tenant externalId search check needs owner run of `scripts/zr-probe.ts` (fail-closed before first prod push, D13).
- Next: merge to mnw done; push waits on P0-6/P0-7 owner gates.

## P0-5 /verify round 1 fixes (2026-10-22)
- Cash: idempotent 23505 no-op, uuid parsed before adminProfile (also markDeposited), unique index now (order_id, workspace_id), types regenerated (FK only), tests deterministic + order-delete/audit test.
- Manual: getProfile `cache()` memoisation unverified by test (check auth logs: dashboard <=2 /user hits).
- Note (pre-existing, not P0-5): deleting a workspace that has audited-table rows already fails.

## P0-5 Done — merge block (2026-10-22) — DONE (merged to mnw, push gated)
- Done: unique(order_id, workspace_id) guard migration 00026; 23505 idempotent no-op in recordCashCollection; auth `cache()` memoisation in rbac.ts; layout/dashboard shared getUser.
- Verify: risk high; /verify round 2 verdict PASS (round 1 fixes applied in 500b369 + follow-up commit).
- Evidence: scripts/gate.sh GATE OK (tsc, 112/112 tests with live RLS, build, secret scan).
- Known low debt: (a) second admin's different amount silently dropped on 23505; (b) migration 00026 gives generic FK error if prod cash rows point at another workspace's order; (c) no test for double-record, EXPLAIN, getProfile memoisation; (d) workspace delete blocked by audit trigger (pre-existing).
- Next: owner backs up before db push 00020–00026 (P0-6). No push until P0-6/P0-7 gates cleared.
- ZR-2 round-2 owner notes: Vercel Hobby only allows DAILY cron, so `vercel.json` is `0 6 * * *` (Pro may use `*/30 * * * *`). `CRON_SECRET` must be set in Vercel (cron 401s without it). Re-register the ZR webhook endpoint in Settings (new event types). Before `db push` of 00027, check remote `zr_shipments` for duplicate `(workspace_id, parcel_id)` (unique index would fail). 00027 `webhook_events` dedupe index is partial (`provider='zrexpress'`). Known debt: cron/refresh derive the situation timestamp from `lastStateUpdateAt` (no `occurredAt` there); same-state equal-timestamp replays are no-ops, equal-timestamp different-state is applied (round 3). Round 3: apply throws when parcel has no lastStateUpdateAt; cron shuffles workspace order; situation timestamp debt (low) stays: a cron/refresh situation older than the webhook occurredAt is skipped until the next event.
- ZR-2 round 4: `apply_zr_state` got `p_live boolean default false`; equal-timestamp different-state applies only when live (Refresh/cron), webhooks ignore ties; same-state check is lower(btrim()). KNOWN DEBT P0-8: `order_stock_effects` does not restore/undo stock when an order leaves returned, so admin corrections out of returned (and ZR regressions) can leave stock wrong.

## ZR-2 Done — merge block (2026-10-22) — DONE (merged to mnw, push gated)
- Done: ZR status sync with stale guard (`apply_zr_state`, p_live ties for live reads only), state/occurred_at/situation stored, cron catch-up (daily on Hobby, shuffled workspaces), webhook partial dedupe index (00027), D9 delivery-queue UI removed, cancel-reason locked on ZR-pushed orders.
- Verify: risk high; /verify round 5 verdict PASS.
- Evidence: scripts/gate.sh GATE OK (tsc, 133/133 tests with live RLS, build, secret scan).
- Known low debt: (D1) ignored webhook tie is marked processed with no error trace; (D2) alternating live ties can write a second order_returned movement (root cause P0-8); situation clock for cron/refresh derives from lastStateUpdateAt; daily cron on Hobby.
- Owner: set CRON_SECRET in Vercel; re-register ZR webhook endpoint in Settings; check remote zr_shipments for duplicate (workspace_id,parcel_id) before db push; back up before pushing 00020–00027.
- Next: P0-6/P0-7 owner gates, then push. No push until cleared.

## v3 setup — loop, skills, plan (2026-11-17) — DONE (branch v3, pushed)
- Done: loop v3 (`.claude/loop.md`, `/auto`, routed review with `ui-reviewer` + `qa-reviewer`, `scripts/step.sh` commit+push per step, gate now checks i18n parity, hardcoded colors, protected paths, deleted tests); shared conventions moved to AGENTS.md; skills: navigation IA v3 in `cod-ui-polish`, structure rules in `mnw-codebase-hygiene`, new `luxe-modesty-store-theme`; 12 specs in `docs/specs/`; MASTER_PLAN v3; decisions D15–D24; Antigravity config in `.agents/` + `docs/ANTIGRAVITY.md`.
- Verify: docs/tooling only, risk low. No app code changed.
- Evidence: `scripts/gate.sh` GATE OK on this Mac (tsc, 63 unit tests, i18n 754 keys, build, secret scan). **RLS suite skipped: 70 tests did not run — Docker/Supabase is not running here.**
- Machine notes: repo moved from Linux to macOS; `node_modules` reinstalled with `npm ci`; the graphify hooks pointed at a Linux path and are now no-ops when graphify is absent; `mnw` is retired in favour of `v3` (D15).
- Owner: inputs O-1…G-1 at the top of docs/MASTER_PLAN.md. Most urgent: O-1 (local Supabase) and P-1 (calculator formulas arrived blank).
- Next: `/auto` picks PRICE-1 or NAV-1 once O-1 is closed; nothing built yet.

## Local stack + night run ready (2026-11-17) — DONE (branch v3, pushed)
- Done: colima + local Supabase on this Mac (`supabase/config.toml`, 27 migrations applied cleanly on a fresh DB), `.env.local` (local only), seed loaded, `scripts/dev-up.sh`, `scripts/night-run.sh`, `scripts/seed-register.mjs` (seed had been broken since `server-only` was added to admin.ts). Owner input O-1 closed.
- Test fix: `rls.test.ts` now arranges its own "confirmed order not assigned to the agent" fixture — a fresh seed assigned every confirmed order to the seed agent, so two D10 assertions had no target. Policies unchanged.
- Evidence: `scripts/gate.sh` GATE OK — tsc, **133/133 tests with the live RLS suite**, i18n, color lint, build, secret scan. Seed admin signs in; `/login` serves 200.
- Skills added: `modern-web-guidance` (Google Chrome; owner's user plugin + copy for Antigravity), `supabase`, `supabase-postgres-best-practices`, `shadcn` (owner-installed). `migrate-radix-to-base` came with shadcn — not to be used.
- Not verified: the loop has not yet run a task end to end; chrome-devtools MCP was added but not exercised; Antigravity untested.
- Next: `scripts/night-run.sh` → `/auto` picks P0-8, then the first eligible rows.

## Run report — /auto 8 (2026-11-17 → 11-18) — STOPPED: three tasks in a row blocked
- Shipped: none. Nothing merged into `v3` except briefs, review files and plan status.
- P0-8 `blocked` (branch `v3-P0-8` pushed, gate OK, review-1 ESCALATE). Owner decides: when a returned order goes to `cancelled`, is the restock taken back off? Then fix: reopening a returned order deducts stock twice; the two live test files share one order (flaky).
- CARRIER-0 `blocked` at brief review (review-0 ESCALATE, no code). Owner provides: official names + codes for wilayas 59–69 and their starting delivery fees (0 DZD = the business pays delivery). Also noted: the map plots wilayas 49–58 in the wrong places.
- NAV-1 `blocked` (branch `v3-NAV-1` pushed, gate OK 143 tests, reviews 1–3 without PASS). No decision needed — one medium left: opening Settings squeezes the sidebar at 720 px height and hides Money. Light theme, agent roles and ⌘K still need a browser check. Owner: set NAV-1 back to `todo` to allow another round.
- Stack note: `v3-P0-8` left migration 00028 in the local DB and broke an RLS test on the next branch; fixed with `supabase db reset` + reseed. Reset again when switching away from a branch that carries an unmerged migration.
- Next `/auto`: PRICE-1 (no deps), then P1-1, NOTIF-1. NAV-2…5, CONF-*, STORE-*, P1-7 stay skipped until NAV-1 / P0-8 / CARRIER-0 are unblocked.

## CARRIER-0 — wilaya map numbering + webhook name match (D26, 58 stays) — built on v3-CARRIER-0
- Done: `WILAYA_CENTROIDS` 49–58 renumbered to the seed (coordinates moved, none invented), all names aligned to seed spelling (fixes Tébessa, Sétif, Saïda, Ghardaïa). New `pickWilaya(rows, name)` in `webhook.ts`: exact, else longest whole-word match, ties lowest code ("Médéa, Algérie" no longer hits Alger). Tests: names vs seed, southern coords, 8 pickWilaya cases. No migration, no DB change.
- Screenshots: taken in dark/light x EN/AR plus a 390 px view (`docs/design/audit/CARRIER-0/map-{dark,light}-{en,ar}.png`, `map-light-ar-390.png`). Local test: 7 orders each in wilayas 49, 53, 58 (restored afterwards). Timimoun, In Salah and El Meniaa plot in the right relative places (Timimoun west of El Meniaa, In Salah south of both), colours correct in both themes, map not mirrored in RTL, no overflow at 390 px. Fixed: legend text `<40%` showed as `40%>` in Arabic (wrapped in `<bdi dir="ltr">`). Known, not fixed: wilaya names stay Latin in AR (D-aliases follow-up).
- Gate: only failure is the live `rls.test.ts` D9/D10 test, which also fails on untouched v3 (stale local DB state, see the run report above).
NAV-1 round 4: Settings moved inside scrolling nav (Money no longer clipped at 1280x720), UserCog + overview first, chevron hidden on active group, 4 new nav tests. Screenshots (chrome-devtools): AR dark admin, EN light 390 px drawer, EN light rail, AR dark agent (docs/design/audit/NAV-1/r4-*). Not checked: interactive keyboard focus walk, single-gear rail (optional, skipped).

NAV-1 round 5: added `groupCounterTotal` (collapsed-header sum, tested; no render test, AppShell needs next-intl/router mocks), rail shows one gear for Settings (brief step 7 "optional" — done). Browser walk (chrome-devtools): admin EN light 1280x720 ⌘K "Delivery" -> Shipping, "Cash" -> Courier cash; keyboard Tab walk shows native focus outline on links and group headers (focus-visible); AR dark Settings page + rail. Found and fixed: with Settings at the end of the scrolling nav the active item/gear was off-screen at 720 px; active link now has aria-current and is scrolled into view. Shots: docs/design/audit/NAV-1/r5-*. Not checked: AR light, EN dark, 390 px after this change.

## NAV-1 round 5 (review-4 FIX, D32)
Settings = one pinned row above the user block (rail: single gear); nav Counter/Leaf/Group hoisted to module scope (focus kept after toggle, verified in browser); phone rows/headers min-h-11 (measured 44px at true 390); palette value=group+label+href, group as keyword and right-side hint, "Ctrl K" off Mac; tests added. Screenshots docs/design/audit/NAV-1/r7-*.png: 1280 EN dark, 1280 AR light, 390 AR dark drawer, rail EN light, confirmation agent EN dark. Not screenshotted: interactive cmdk typing, tooltip hover, delivery agent. Review-4 #6 deferred to NAV-2 per D32.

## NAV-1 round 6 (D33)
Bottom/top edge fade on the sidebar list (token colour, click-through, ResizeObserver + scroll); active group title is a plain label; palette search no longer matches hrefs; collapsed group counter announced ("Sell, 26 pending", en+ar); no role = no brand link. Screenshots (chrome-devtools) in docs/design/audit/NAV-1/r8-*: admin 1280x720 dark (fade bottom 1 -> 0 after scroll), AR light, icon rail, 390 px drawer, confirmation agent (no fade, no group buttons). Delivery agent not separately screenshotted (same code path).
## Run report — /auto 8 (2026-11-18) — STOPPED: three tasks in a row blocked for technical reasons
- Shipped: none. `v3` gained only briefs, review files, decisions D29–D33, questions Q-3–Q-5 and plan status.
- Decided by Claude (owner may overturn): D29 swapped order holds no stock, its replacement holds it from creation, exchange keeps stock, old orders not recounted · D30 stock moves only inside one workspace (trigger guard now, composite key in STORE-1) · D31 an order linked to its swap replacement never takes stock back, carrier status still followed · D32 Settings is one pinned row above the user block · D33 sidebar list fades at its edge when items are hidden.
- Questions: none waiting. Q-3, Q-4, Q-5 (P0-8) are applied by default in `docs/QUESTIONS.md`; Q-5 recommends making the stock log add-only and waits for a yes.
- P0-8 `blocked` (branch `v3-P0-8`, migrations 00028–00030, reviews 2–4 this run, no PASS). Left: apply D31, make `swap_order` safe on double submit, one review.
- CARRIER-0 `blocked` (branch `v3-CARRIER-0`, gate OK 143 tests, code judged correct in review-3). Left: Arabic legend still reversed in the 390 px map screenshot — retake or fix, one review.
- NAV-1 `blocked` (branch `v3-NAV-1`, gate OK 154 tests by the builder, reviews 4–6 this run, D32/D33 work). Left: Escape does not close the 390 px drawer, closed drawer is tabbable, ⌘K matches internal page keys, one review.
- Each task is close but each review round found new medium findings; rounds were counted per attempt (3 per run after the owner reset a task to `todo`). To continue any of them, set its row back to `todo`.
- Loop notes: (1) the live test suite is not isolated — the gate fails 1–3 tests on a used local DB and passes after `scripts/db-reset.sh`; (2) `db-reset.sh` seeding fails on some first runs and works on retry; (3) `execute` does not merge `v3` into an existing task branch, so it read stale briefs until the coordinator merged; (4) `decide` writes D-rows on the task branch — the coordinator copied them to `v3`.
- Next `/auto`: P1-1 (KPI contract), then NOTIF-1, PRICE-1. NAV-2…5, CONF-*, STORE-*, P1-7 stay skipped until NAV-1 / P0-8 / CARRIER-0 are unblocked.

## CARRIER-0 — DONE (merged under D40, owner asked to merge)
- Verify: reviews ended without PASS; no high finding open. Open medium/low moved to follow-up row CARRIER-0-F.
- Evidence: full scripts/gate.sh GATE OK on the branch with v3 merged in (143 tests).
- Open: Arabic legend in the 390 px map screenshot reported reversed (review-3).
## NAV-1 — DONE (merged under D40, owner asked to merge)
- Verify: reviews ended without PASS; no high finding open. Open medium/low moved to follow-up row NAV-1-F.
- Evidence: full scripts/gate.sh GATE OK on the branch with v3 merged in (154 tests).
- Open: Escape does not close the 390 px drawer; closed drawer still tabbable; ⌘K matches internal page keys (review-6).

## P0-8 — DONE (three-stage stock D34, add-only log D35; merged under D40)
- Done: migrations 00028 (stages, reconcile, swap guard D42, add-only stock log, delete rule D41) + 00029 (reconcile existing orders); stock pages; 26+ stock tests.
- Verify: brief review-0 + code reviews 5–7 on the restarted build; review-7 has no high finding. Open medium moved to P0-8-F.
- Evidence: full scripts/gate.sh GATE OK, 200 tests with the live RLS suite, after db-reset.
- Owner: production db push of 00028–00029 is owner-only (O-2); Q-3 read-only count on real data before it.

## P0-8-F — DONE (merged under the coordinator's /ship run)
- Done: swap replacement cancelled at confirmation releases stock only before pickup; DB swap guard; ZR skip; review-7 lows (see brief and review-1..3).
- Verify: review-3 VERDICT: PASS (highest-numbered review); no high finding open.
- Evidence: scripts/gate.sh GATE OK on v3-P0-8-F (209 tests incl. live RLS suite, tsc, i18n parity, color lint, build, protected paths, secret scan).
- Owner: production db push of new migrations is owner-only.
- Next: none in this row; continue with the next todo task in MASTER_PLAN.

## CARRIER-0-F — Arabic map legend at 390 px
- Done: legend verified correct in AR light + dark at a true 390 px (chrome-devtools emulate); stale PNG replaced, map-dark-ar-390.png added; map tooltip uses dashboard.wilaya.noData (new noDataLabel prop); wilaya code in table label wrapped in bdi dir=ltr; source-level bdi test added (no component test setup).
- Screenshots (review-1 FIX, chrome-devtools, filters/dev badge removed, all viewed): map-{light,dark}-{ar,en}-390.png are element shots of the card; map-{light,dark}-{ar,en}-1280.png are viewport shots framing the whole card. Seen, not fixed (out of scope): hyphen between wilaya code and name wraps/leads in AR 390 (review #3), table clips its last column at 390, legend wraps 4+2 (review #4).
- CARRIER-0-F follow-up (fix before review 2): wilaya label now `<bdi ltr>code</bdi> · <bdi>name</bdi>` nowrap (review #3); table min-w-[34rem] inside its overflow-x-auto so the last columns scroll instead of clipping at 390 px, page has no horizontal overflow (fixed); map tooltip falls back to the wilaya name via a `names` prop (review #5). Retook map-{light,dark}-{ar,en}-390.png (chrome-devtools, viewed). Legend 4+2 wrap (review #4) left as is.
- CARRIER-0-F review-2 FIX: wilaya table gets an end-edge fade (data-scroll-fade, token surface) while columns are hidden at 390 px (verified AR light 390, viewed); separator no longer aria-hidden; legend 3-col grid below sm; tooltip text extracted to `wilayaTitle` plus tests (label structure, title fallbacks); retook all four map-*-1280.png on current code (viewed, `code · name`).
- Done (CARRIER-0-F): legend verified in AR/EN light+dark at 390 px and 1280 px; wilaya label bdi/nowrap; table scrolls with end fade; tooltip falls back to name.
- Verify: review-3 VERDICT: PASS (highest-numbered review); gate.sh GATE OK on v3-CARRIER-0-F (214 tests incl. live RLS suite).
- Evidence: map-{light,dark}-{ar,en}-{390,1280}.png retaken and viewed on current code.
- Owner: none. Legend 4+2 wrap (review #4) and hyphen wrap in AR 390 left as is (cosmetic, out of scope).
- Next: none in this row.

- NAV-1-F: drawer inert/Escape/dialog/focus-return + palette value fix. Verified at 390px (AR, app theme light) via DOM script: inert when closed, role=dialog open, focus in, Escape closes and refocuses toggle. Screenshot of open drawer viewed. EN/dark matrix not captured.
- NAV-1-F review-1 FIX: content column inert while phone drawer open; verified at 390 (Shift+Tab never reaches header/main); screenshots en-dark and ar-dark drawer in docs/design/audit/NAV-1-F/.

## NAV-1-F — done
- Done: phone drawer Escape closes and returns focus; closed drawer and content inert while open; dialog role; palette search value fix.
- Verify: review-2 VERDICT: PASS (highest-numbered); scripts/gate.sh GATE OK on v3-NAV-1-F (217 tests incl. live RLS suite).
- Evidence: 390 px DOM script (AR, light) plus drawer screenshots in docs/design/audit/NAV-1-F/. EN and dark matrix not captured.
- Owner: none.
- Next: none in this row.

## P0-8-G — swap badge + tests (2026-11-18) — DONE (pending review)
- Done: tests for linked swap original (follows status, stock fixed, unlink, admin cancel via RPC), zr_state_map strips `swap`, swapOrder tests, SwapBadge on orders list / delivery table / kanban / detail, DB.md fixes.
- Screenshots (chrome-devtools): list, delivery table, kanban, detail checked in EN dark, EN light, AR dark (kanban), AR light (list). Fixed list overflow (badge under order number) and order-number wrap. Not every surface x locale x theme combination was viewed; remaining ones share the same component.
- Known: AR badge shows "#id" bidi-reordered (pre-existing wording in swap.swappedTo).
- P0-8-G review-1 FIX: swap badge now shows '#number' (bdi ltr, full sentence in title), delivery badge stacked. Screenshots list EN/AR at 1280 and 390 (light) viewed OK: docs/design/audit/P0-8-G/list-*-{1280,390}.png. Dark theme not re-shot.
- P0-8-G review-2 FIX: swap badge now shows icon + 'Swap'/'تبديل' + #number; swapTargets chunked. Screenshots (390/1280, EN/AR, dark) viewed: docs/design/audit/P0-8-G-r3/. Light theme not re-shot (token-only change).

## P0-8-G — ship (done)
- Done: linked swap original follows carrier with stock fixed at 0; swap badge on list/delivery/kanban/detail; swapOrder action tests (double submit, non-uuid); MASTER_PLAN row set to done.
- Verify: review-3 VERDICT: PASS (highest-numbered); scripts/gate.sh GATE OK on v3-P0-8-G (226 tests incl. live RLS suite).
- Evidence: screenshots in docs/design/audit/P0-8-G/ and docs/design/audit/P0-8-G-r3/. Light theme for the badge not re-shot after review-2 (token-only change).
- Owner: none.
- Next: none in this row.

## P1-1 — DONE (KPI contract; merged under D40)
- Done: 00031 kpi_order_set / kpi_lines / kpi_summary / product_stock_v, 00032 swaps only from returning/returned; dashboard, finance overview, product pages read the contract; D46–D48.
- Verify: brief review-0 + code reviews 1–4; review-4 no high finding, two medium moved to P1-1-F.
- Evidence: full scripts/gate.sh GATE OK, 251 tests with the live RLS suite, after db-reset.
- Owner: production db push of 00031–00032 is owner-only (O-2).

## P1-2 — built (Dashboard v2, awaiting review)
- Done: six bands (needs action, money, journey, waterfall, stock, product scorecard) from dashboard_stats().kpi, product_stock_v, pnl_by_product; USD-first ad spend and cost per delivered; filters cut to period + product; loading skeleton; en/ar `dashboard.v2.*`.
- Removed from dashboard: wilaya table/map, status breakdowns, per-agent, category spending, tasks, meeting, TimeChart, export (moves: Statistics STATS-2/3, Team, Money, NAV-5). Deleted export-button, time-chart, status-breakdown-bars, category-bars. Kept wilaya-section.tsx (algeria-map.test.ts reads it; STATS-2 owns it). Kept dashboard.wilaya/statusBreakdown/myTasks/meeting i18n keys for those pages.
- Screens: chrome-devtools, EN dark 1280, AR light 1440 and 390, EN dark 390 viewed; fixed negative journey drop-offs and RTL USD/DZD alignment. Not captured: no-rate, empty workspace, period+product states.
- Evidence: full gate GATE OK after db-reset, 262 tests.

### P1-2 review-1 FIX
- Fixed: stock band now has In stock / Reserved / On road / Low-stock totals plus per-product In stock, Reserved, On road, Delivered at every width, and follows the product filter; scorecard has a stock column and becomes stacked cards below md (no clipping at 390), "Set a USD rate" shown once as a link to exchange-rate settings; empty period (no delta arrow for unchanged/0 baseline, no "-0", "No data for this period", unknown product id dropped, no UUID chip); "To retry" link carries no_answer,closed_phone (orders/all accepts a comma list); profit and cost-per-delivered link to finance overview; money band 3+2 with cash tile spanning, hero tile fills its card; journey Delivered drop labelled "of confirmed" and neutral; filter bar moved under the header, band 1 marked "not filtered"; waterfall bars min 6px; retry is a router.refresh button; subtitle reworded.
- Screens (docs/design/audit/P1-2/r2-*): EN dark/light 1440, AR dark 1440, EN dark/light 390, AR dark/light 390, empty period EN 390, empty workspace (ws2-admin) EN dark 1440, loading skeleton AR light. AR light 1440 re-shot.
- Not captured: EN skeleton in dark; the skeleton shot is the route-level one.

## P1-2 — DONE (Dashboard v2)
- Done: six dashboard bands (needs action, money USD-first, journey, waterfall, stock, product scorecard) on dashboard_stats().kpi, product_stock_v, pnl_by_product; loading skeleton; en/ar dashboard.v2.*; wilaya/status/tasks/meeting/export/time chart moved to STATS/Team/Money/NAV-5.
- Verify: review-1 FIX, review-2 VERDICT: PASS (highest-numbered); scripts/gate.sh GATE OK on v3-P1-2 (265 tests incl. live RLS suite) after db-reset.
- Evidence: screenshots docs/design/audit/P1-2/ (r2-*); not captured: EN skeleton dark, no-rate state.
- Owner: none.
- Next: none in this row.

## TEST-1 — live test isolation
- Done: cash.test builds its own workspaces/product/orders and removes them; kpi.test and stock-stages.test afterAll now delete audited-table rows before the workspace (the cascade audit insert hit the audit_log FK and the delete failed silently, leaking ~1100 orders per run).
- Verify: db-reset, then gate --fast x3: GATE OK, 265 tests, counts orders/cash/customers 60/20/26 constant; workspaces 1 -> 2 after the first run only (rls.test keeps "RLS Test WS2" by design, reused by name).
- Owner: none.

## TEST-1 — DONE (live test isolation)
- Done: cash.test builds and removes its own data; kpi/stock-stages delete audited rows before their workspace; rls.test unchanged (WS2 persists by design).
- Verify: scripts/gate.sh on v3-TEST-1 this run: GATE OK, 265 tests incl. live RLS suite. Row-count check and the second consecutive run were not re-run in this step.
- Evidence: gate lines tsc, tests, i18n parity, color lint, build, protected paths, secret scan all PASS.
- Owner: none.
- Next: none in this row.

## SEC-1 — redact secrets in audit_log
- Done: migration 00033 (`audit_redact()`, `audit_row()` wraps old/new, backfill scrub; search_path public, pg_temp); `src/lib/audit-redact.ts` second layer in the audit page; redacted values shown as `[redacted · ab12cd34]` mono chip with tooltip (`audit.redacted`, en+ar); unit + live RLS tests.
- Verify: scripts/gate.sh GATE OK, 272 tests. Screenshots EN + AR (dark only) docs/design/audit/SEC-1-{en,ar}.png: chip readable, diff shows changed fingerprint, RTL ok. Light theme not checked.
- Owner: none. Backfill matched 99 local rows (broad key regex, over-redaction accepted per brief).

- SEC-1 review-1 FIX: explicit secret-key list (color_token etc. untouched), non-string values and settings `{key,value}` masked, redaction + display on the server (`_lib/diff.ts`, `audit-redact.ts` server-only, no browser crypto), `<bdi dir="ltr">` cells, bordered chip, `audit_redact` stable + revoked from anon/authenticated. 00033 edited in place (unmerged) and verified by local db reset; seed test secret gone. Backfill rewrites `audit_log` in place on remote (owner push). Non-object fingerprints in TS may differ from SQL (jsonb text format); primitives match. AR light / 390px screenshots not retaken.

## SEC-1 — DONE (audit-log secret redaction; merged under D40)
- Done: 00033–00035 `audit_redact` fail-closed (D49) in `audit_row()` + idempotent backfill of `audit_log`; server-side diff with redacted chip on /app/settings/audit.
- Verify: security reviews 1–4; review-4 no high finding, two medium moved to SEC-1-F.
- Evidence: full scripts/gate.sh GATE OK, 300 tests with the live RLS suite.
- Owner: production db push of 00033–00035 is owner-only (O-2); the backfill rewrites audit_log rows (contents only, none deleted).

## SEC-1-F — audit redaction follow-up (D40)
- 00036: `audit_is_secret_key` (acronym + camel + case-only normalisers), depth cap 64, non-string fingerprints = jsonb text; TS twin + shared case table (`audit-redact.cases.ts`) with live parity test. Diff badge only when masked; table renders `<ul>` rows; pill localised (`audit.redactedPill`).
- Screenshots (self-critique via chrome-devtools): docs/design/audit/SEC-1-F/ {en,ar}-{dark,light}-1440, ar/en 390. Found and fixed: Arabic pill word reordered around the arrow inside the LTR cell; fixed with an isolated `inline-block dir=ltr` pill. Not all 8 combos retaken after that fix (en-* 1440 predate the pill isolation; EN unaffected visually).
- Note: local `db reset` wipes seed users; reseed needs a temporary `node_modules/server-only` stub (seed-dev imports admin.ts).

## SEC-1-F — DONE (merged under D40)
- Done: 00036–00038 acronym and run-together secret names (D49 amended), null handling past depth cap; audit table one row per change, works at 390 px.
- Verify: reviews 1–3; review-3 no high finding and no secret leak; one medium (SQL/TS output differs exactly at depth 64) moved to SEC-1-G.
- Evidence: full scripts/gate.sh GATE OK, 331 tests with the live RLS suite.
- Owner: production db push of 00036–00038 is owner-only (O-2).

## PRICE-1 — DONE (pricing-v2 engine + pinned tests)
- Done: `src/lib/pricing-v2.ts` owner formulas, settings as parameters (D38), unit tests pinning every number of the benz test in `docs/specs/PRICE.md`; no DB, no UI.
- Verify: qa-reviewer review-4 VERDICT PASS (risk high); brief rev 1 after review-0..3 fixes and D51/D52.
- Evidence: scripts/gate.sh GATE OK, 377 tests with the live RLS suite.
- Owner: none.
- Next: PRICE-2 (pricing settings UI, per-product overrides).

## PRICE-2 — pricing settings + product overrides + Pricing tab (2026-11-18) — BUILT (awaiting /verify)
- Done: `product_pricing` (00039, composite FK, admin RLS, audited), Settings -> Pricing section (save/reset), product Pricing tab on `pricing-v2.ts` with overrides/ads/final price/save.
- Dropped: the old Real column (`realInputsForProduct`) is gone from the tab until PRICE-3. BENZ `/products/planner` untouched.
- Screenshots: dark, EN, ~430px only (Settings + product tab). Light, AR and desktop NOT checked.
- Note: `node_modules/server-only` stub created locally so seed-dev.ts runs (not committed).

PRICE-2 review-1 fixes: blur reports clamped value, typed/saved overrides pinned even if equal to default, target mode needs a value, quantity validated, action tests added, units in i18n, anon revoked (00040), placeholder clipping fixed (shorter placeholder, ltr isolates). Screenshots (chrome-devtools, 500px min viewport, product Pricing tab): dark EN, light EN, dark AR checked; light AR and desktop width not captured.

## PRICE-2 — DONE (merged under D40)
- Done: 00039–00040 `product_pricing` (admin-only RLS, composite FK, audited, anon revoked); Settings → Pricing defaults; product Pricing tab on `pricing-v2.ts` with per-product overrides, ad costs, final price.
- Verify: reviews 1–4 (qa-reviewer + ui-reviewer, app run and keyboard checked in round 4); review-4 ESCALATE with no high finding; one medium (two keyboard focus tests missing) and the lows moved to PRICE-2-F. Decisions D53 (below-break-even final price saves without a confirm).
- Evidence: full scripts/gate.sh GATE OK, 436 tests with the live RLS suite.
- Owner: production db push of 00039–00040 is owner-only (O-2). Screenshots at 390 px were incomplete in review-2 — worth a look on a phone.
- Next: STORE-1.

## STORE-1 build notes
- Screenshots: chrome-devtools MCP used for stock page and product page, dark, EN, ~390px only. Not done: light theme, AR, 1280px, order form, old-order, inactive, error views, keyboard walk.

## STORE-1 — DONE (merged under D40)
- Done: 00041–00048 product options, values and sizes (`product_variants`), `products.variants` migrated, stock per size with "not assigned" and "Count by size" (D54), options and sizes saved in one database transaction (D55); options editor, per-size stock page, order size picker.
- Verify: brief reviews 0–1, build reviews 2–4 (qa-reviewer + ui-reviewer, app run, keyboard checked EN + AR); review-4 ESCALATE with no high finding; its one medium (gate flaky on a test-cleanup deadlock) fixed test-only under D56; lows moved to STORE-1-F.
- Evidence: full scripts/gate.sh GATE OK, 473 tests with the live RLS suite; four `--fast` runs in a row OK after the D56 retry.
- Owner: production db push of 00041–00048 is owner-only (O-2). Every product with sizes shows "Count needed" until its sizes are counted once (D54).
- Next: STORE-2.

## STORE-2 — stores, store_pages, theme, public product page (2026-11-18) — DONE
- Done: migration 00049 (stores, store_pages, composite FKs, RLS, grants); server-only DAL with cost-free DTO and ISR (120 s, tags, `updateTag` in product/variant/stock/store actions); route groups `(app)` and `(store)/s` with their own root layouts; `/s/<store>/<slug>` with 404/loading/error; admin Store group (Hub, Pages, Editor, Preview, Settings).
- Moved: all app routes into `src/app/(app)/`; `@/app/...` imports and 3 test paths updated.
- Screenshots (docs/design/audit/): store 390 light and 1280 dark, app hub (AR dark), pages (AR dark), editor (AR dark), settings (EN light), preview (EN light). Not shot: every state in both themes and 390 dark.
- Verified live: unpublished 404 stays cached until the UI publish, then 200; UI unpublish gives 404; no Set-Cookie; `locale=en` cookie still Arabic. Lighthouse mobile: a11y 100, best practices 96, SEO 91. LCP/CLS/photo weight not recorded (test photos are external).
- Known: preview uses the OS colour scheme and fallback fonts, not the app theme; no product delete action exists, so L4 is moot (DB check refuses an unlink of a published page).

## STORE-2 — DONE (merged under D40)
- Done: 00049 `stores` + `store_pages` (admin-only pages, no anon grants); public product page at `/s/<store>/<page>` (Arabic RTL, cached, published-only DTO with no cost fields, in-stock per D54.4/D58); Store admin: hub, pages list, page editor with publish/unpublish, preview, settings; app routes moved under `(app)`, store under `(store)`.
- Verify: brief reviews 0–1, build reviews 2–4 (qa-reviewer + ui-reviewer, app run); review-4 ESCALATE with no high finding; its one medium fixed under D58 (written as D57 on the branch); lows moved to STORE-2-F.
- Evidence: full scripts/gate.sh GATE OK, 507 tests (3 skipped) with the live RLS suite.
- Owner: production db push of 00049 is owner-only (O-2). No order form on the page yet (STORE-3/4). Store assets (S-1) still open — logo, photos, policy texts.
- Next: STORE-3.

### ORD-1 round 4 (D59)
- data-table.tsx: table outline off only while a row is current (ring is the single indicator; with no row current the table outline shows); frozen column divider is now an `after:` line on the sticky th/td (logical end, `border-strong`), border-collapse kept.
- Tests in orders.order_seq.rls.test.ts: real fallback via psql, ON CONFLICT asserts, swap_order, manual insert (admin session), webhook replayEvent.
- Browser check done (chrome-devtools): EN dark + AR light on orders/all, AR dark on delivery; orders/all `?product_id=x` error state + Retry in EN and AR. Screenshots `docs/design/audit/ORD-1/r4-*`.

## ORD-1 — DONE
- Done: per-workspace order number `#0001` (D57, migration 00050, DB-assigned running number, shown everywhere); frozen data-table cell follows row hover/selected/focus in both themes and RTL; round-4 focus and divider fixes (D59).
- Verify: brief reviews 0–2 FIX, review-3 ESCALATE, review-4 PASS (qa-reviewer + ui-reviewer); full scripts/gate.sh GATE OK (523 tests, 3 skipped, live RLS suite).
- Evidence: round-4 browser check and screenshots in docs/design/audit/ORD-1/r4-*; order_seq RLS tests cover fallback, ON CONFLICT, swap_order, manual insert, webhook replay.
- Owner: production db push of migration 00050 is owner-only.
- Next: ORD-1-F (review-3 #6 ring across frozen column, Tab walk, missing screenshots, error-path tests, lows).

## Run report — /auto 5 (2026-11-18 → 19)
- Shipped 5: PRICE-1 (4158505), PRICE-2 (88b7be8), STORE-1 (afef55e), STORE-2 (3be4795), ORD-1 (d77e828). PRICE-1 and ORD-1 ended on a PASS review; PRICE-2, STORE-1, STORE-2 merged under D40 (last review ESCALATE, no high finding) — the ship stage refuses those, so the coordinator ran its steps by hand.
- Decided by Claude (owner may overturn): D51 markup % is on the product's own cost per piece · D52 PRICE-1 edge rules (share up to 100%, target needs its mode, markup max 1000%) · D53 a final price below break-even saves without a confirm · D54 sizes start uncounted, existing stock "not assigned", admin counts per size · D55 options and sizes save in one transaction; no new option once sizes exist · D56 test clean-up retries after a deadlock · D58 a negative "not assigned" never hides a size that has pieces (D57 on the branch; renumbered, D57 is the owner's order number) · D59 ORD-1 last round.
- Questions: none waiting; Q-8…Q-13 are answered by default in docs/QUESTIONS.md and can be overturned.
- Blocked: none. Follow-ups added: PRICE-2-F, STORE-1-F, STORE-2-F, ORD-1-F (placed after the owner priority rows).
- Known issue: the fast gate failed once in 4 runs right after the STORE-1 merge (test clean-up deadlock, reduced not gone — STORE-1-F).
- Owner: migrations 00039–00050 wait for the production push (O-2). Products with sizes show "Count needed" until counted once.
- Next /auto: STORE-3 (pricing modes, offers, order form fields), then P1-7, STORE-4.

## STORE-3 — build done (pending /verify)
- Done: migration 00051 (pricing mode, compare price, per-value delta, per-size override, `product_offers` quantity + bump, `product_forms`); pure `offer-price.ts` (unit price, offer charge, mixed-size `piecesCharge`, "starting from") shared with STORE-4; `form-fields.ts` zod contract; public DTO with pricing, offers, bump and form fields (no cost, sku, stock count, free delivery); admin Selling tab (mode switch, offers + bump, form editor, "View on store"); `OrderForm` component rendered only in the admin preview (inert, `method="post"`); public page shows an honest "orders open soon" state, no button.
- Moved: D58 stock rule into `variant-stock.ts` (same behaviour); store layout queries (`.store-top`, `.store-grid`) now use a container query on `.store-main` so the 390 preview frame lays out like a phone.
- Tests: live RLS `offers.rls.test.ts`, DTO tests in `data.test.ts`, `offer-price`, `form-fields`, `selling-schemas`, order-form markup. Existing `variants.rls.test.ts` "no cost field" check now allows the three selling-price columns.
- Screenshots: NOT done in this build session (no browser run); the ui review must take the 390 + 1280, light + dark, AR + EN set listed in the brief.

## STORE-3 — review 1 fixes
- Fixed: 1 integer number field no longer joins digits across a dot ("2500.00" -> 2500, `integerInput` + test) · 2 sized products show the crossed-out price of the cheapest size · 3 all sizes unsellable -> public page 404 (admin preview still renders) · 5 per_value crossed-out price adds the size delta. Tests added for each.
- Local store: `scripts/seed-dev.ts` now seeds a live store `demo` with `/s/demo/abaya-luxe` (S/M/L, S out of stock, 2 offers, bump, compare 6500) and `/s/demo/hijab-soie` (plain). Re-run the seed command in docs/TOOLING.md (idempotent).
- Screenshots (Chrome DevTools MCP): store page 390 light AR, 1280 dark AR, 860 light AR (2-column layout holds, container query ok); admin preview 1280 dark AR with the order form and the validation-error state. Not captured: EN locale, 390 dark, preview in light, the 4-column related grid (no related blocks in the seed), 0-offer page.
- Not fixed (LOW, left for later): 6 non-atomic `saveOffers` (must be resolved before STORE-4 stores offer ids), 7, 8, 9, 10 .

## STORE-3 — round 4 (D61)
- Fixed review-3 #1, #3, #4, #5 (tests: price-0 sizeless 404, mixed-size piecesCharge). Screenshots: not captured here (no browser run); ui-reviewer to capture r4-* list. Follow-ups rewritten in docs/briefs/STORE-3.followups.md.
- P1-7 screenshots (browser MCP, AR + light + 1280 only): CSV dialog preview, fee grid after apply, order form. Not covered: dark, EN, 390px, warning/failed/applying dialog states, commune picker open. Fixed from screenshots: before/after values forced LTR in the preview cards.
- P1-7 round 2 (review 1 FIX): push refuses any unpriced wilaya; swap recomputes the fee (migration 00053, also hardens apply input); admin "switch to home" action; createOrder/swap/saveWilayaFees return inline i18n errors; alert under Wilaya; grid scrolls with the page on phones; CSV dialog follows page direction, translated file picker, client size check, 2-col footer, Apply off at 0 changes; re-enabling a wilaya needs a fee above 0. New tests: push guard/COD/workspace scope, createOrder block, saveWilayaFees, syncZRFees, swap fee, parser fixture. Screenshots in docs/design/audit/P1-7-r2 (grid EN dark 390, grid AR light 1280, dialog preview AR light 1280, order form unpriced EN dark 390). Not covered: dialog warning/failed/applying/oversize states, commune picker open, stop_shipping wilaya, other theme/locale combos. Known: a failed grid save resets unsaved edits (React form reset).

P1-7 round 3: fixed review-2 mediums (stop_shipping switches controlled; order-form name/address controlled; commune-name diff; migration 00054 sets 0/0 wilayas priced=false, default priced=false, swap honours stop_shipping). Owner note: on remote this turns shipping off for wilayas still at 0 DZD until a CSV is imported. Grid fee inputs now have aria-labels.

P1-7 round 4 (D62): migration 00055 (flags off where a priced type has fee <= 0, then two CHECKs; `apply_delivery_prices` raises on the same cases). Parser: a price <= 0 gives a `zero_price` warning and that type is not offered. `saveWilayaFees` checks every row it writes and writes nothing on refusal. ZR sync writes prices only, ignores a ZR price not above 0, returns `{updated, off}` and the toast says both (EN + AR plurals). Push guard: stop-desk exception in a home-only wilaya needs an order fee above 0. `createOrder` uses safeParse (`orders.form.invalid`), Product marked required. Form reset: grid, new order and swap card submit through `useSubmitAction` (`src/lib/use-submit-action.ts`: preventDefault + startTransition), no `action=`. Tests: parser `:0`, sync (unpriced row, ZR 0), grid save refused on cleared fee, no-product order, push fee 0, and in the live suite the 00055 updates replayed on three bad rows (psql transaction, constraints dropped, rolled back), direct service-role write refused, apply refused.
- Not done: no browser tool in this session, so the `r4-*` screenshots and the live check of the three forms (grid case, refused new order, refused swap) were not taken. Left to ui-reviewer.
- Owner note: after the production database update, a wilaya whose home price is 0 has shipping off, and a wilaya whose stop-desk price is 0 has stop-desk off, until the price sheet is uploaded or the switch is turned on. Confirmed orders not yet sent to ZR for a wilaya that is off are refused at "Send to ZR" until then. Run this read-only query before the update to count them:
```sql
select
  (select count(*) from wilaya_fees where priced and home_fee <= 0) as wilayas_going_off,
  (select count(*) from wilaya_fees where priced and stopdesk_available and stopdesk_fee <= 0 and home_fee > 0) as wilayas_losing_stopdesk,
  (select count(*) from orders o join wilaya_fees f on f.workspace_id = o.workspace_id and f.wilaya_code = o.wilaya_code
     where o.confirmation_status = 'confirmed'
       and not exists (select 1 from zr_shipments z where z.order_id = o.id)
       and f.priced and (f.home_fee <= 0 or (o.delivery_type = 'stopdesk' and f.stopdesk_available and f.stopdesk_fee <= 0))) as confirmed_unsent_orders;
```
- Follow-up P1-7-F (D62 item 7) to be added as a plan row at ship.

P1-7 round 5 (last allowed round; findings 8 → 3 → 2 → 1): fixed the one medium. A home label priced 0 now still counts as "home seen", so Béchar's `home:0|home:720` gives stop-desk 720, home none, wilaya not priced (parser test on that exact row). Also `method="post"` on the grid, new-order and swap forms (no GET with personal data before hydration). Round 5 ran because the D40 merge without a PASS verdict is refused by the ship step. Other lows left to P1-7-F.

## P1-7 done (review-5 PASS)
- Done: delivery prices from the owner's CSV (wilaya fees, preview then apply, grid edits, ZR sync prices only, 0 is never a price, D62 rounds 1-5). Migrations 00052-00055.
- Verify: `scripts/gate.sh` GATE OK (tsc, 572 passed / 3 skipped with live RLS suite, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/P1-7.review-5.md PASS (no high or medium in the round-5 diff); screenshots docs/design/audit/P1-7-r5/.
- Open: P1-7-F (review-5 lows, pre-existing swap medium on a typed wilaya name, reviews 3-4 leftovers, missing tests).
- Owner: migrations 00052-00055 await the production push (O-2). Run the D62 read-only count query before the update; wilayas with a 0 home or stop-desk price go off until a sheet is uploaded or the switch is on.
- Next: STORE-3 (blocked on merge OK), then STORE-4 once P1-7 is merged to v3; P1-7-F after the owner's priority rows.

STATS-2 build: screenshots taken in dark EN only (empty state, populated, drilled Alger) with chrome-devtools; light theme, AR and 390px NOT verified. Fixed Return column clipping by stacking the map below the table until 2xl.

STATS-2 round 2 (review-1 FIX): fixed findings 1-8, 10-13 (drill error -> retry block, drill banner + drop drill params on filter/sort change, Unknown wilaya row without drill, 390px compact table with no horizontal scroll, commune panel capped to viewport + sticky name column, statistics error reason, extras gated by is_admin in migration 00060, shared ISO_DATE, `commune_unknown=1` param, visible drill-link underline, 44px chevron hit area, empty-state action). Not done: 9 (home/stop-desk drill), 14 (no breadcrumb component exists app-wide). Screenshots (chrome-devtools): light 390 EN and AR with the commune panel open, empty state, drill banner in docs/design/audit/STATS-2/. Agent redirect checked (307 to /app/orders, no data in body). Real error state not forced (no safe way to make the RPC fail locally).

## STATS-2 done (review-2 PASS)
- Done: `/app/statistics` wilaya confirmation/delivery table with commune drill-down (KPI RPCs 00059-00060, extras gated by is_admin, drill banner, 390px compact layout).
- Verify: `scripts/gate.sh` GATE OK (tsc, 588 passed / 3 skipped with live RLS suite, i18n parity, color lint, build, protected paths).
- Evidence: docs/briefs/STATS-2.review-2.md PASS (no high or medium); screenshots docs/design/audit/STATS-2/ (dark EN not re-shot in review 2).
- Open: STATS-2-F (12 lows, missing brief tests, review-1 findings 9 and 14).
- Owner: migrations 00059-00060 need the production push; product call on Latin names in AR (STATS-2-F).
- Next: STATS-2-F after the owner's priority rows; STATS-3 is unblocked once STATS-2 merges to v3.

## STATS-3 UI self-critique
Screenshots (light, EN): statistics with season + compare strip, Seasons tab at 390px. Dark theme, AR, other states not screenshotted.

STATS-3 round 2 (review-1 FIX): fixed 1-5, 7, 9-13 and part of 14 (unknown filter values dropped with a note, Period field shows the season range, no highlight when dates override plus a "Selected" label, "In progress" only while the period is open, named delete buttons and season-specific confirm, unique (workspace_id, season_id, year) in 00062, orders/all leaveDrill clears category and conf_agent, rename keeps the translated name when unchanged, savePeriod errors on 0 rows, lone season remembered, formatted counts, seasons-load error with retry, ltr period chip). Not done: 8 partly (no chips added), the bar height on mobile, extra tests listed under "Missing tests" except savePeriod/rename. Screenshots (chrome-devtools, docs/design/audit/STATS-3/r2-*): 390px dark EN and AR with 4 filters + dropped notes + overridden compare, Seasons edit dialog 390 dark AR. Not captured: light AR, desktop dark/AR, compare error, Seasons empty/error (no safe way to force them locally).

## STATS-3 round 5 (D66)
- Orders/all drill chips: category shows "Category: <label>", delivery type shows the translated home/stop-desk label, only home/stopdesk accepted (otherwise dropped, `role=status` note); unknown label falls back to "<field>: Selected". Pure fns + tests in `orders/_lib/drill-filters*.ts`.
- Browser (chrome-devtools, viewport locked at 390): screenshots `docs/design/audit/STATS-3/final-orders-drill-390-{en-dark,ar-dark,en-light}.png`, `final-stats-390-{en,ar}-dark.png`. Chip removal and Clear all verified on both pages. Not done: 1280 screens and Settings > Seasons dark EN 1280 (viewport could not be resized). Correction (STATS-3 review-5, STATS-3-F): removing one Statistics chip keeps season+year; only the season chip drops both, by design.

## STATS-3 done (review-5 PASS, D66)
- Done: admin seasons (named date ranges per year, migrations 00061-00062) and one URL-state filter bar on Statistics; Orders/all drill chips (category label, translated delivery type, checked values).
- Verify: `scripts/gate.sh` GATE OK (tsc, 627 passed / 3 skipped with live RLS suite, i18n parity, color lint, build, protected paths, secret scan). Retry after test-cleanup 8f72ccb; local DB reset to 00062.
- Evidence: docs/briefs/STATS-3.review-5.md PASS; screenshots docs/design/audit/STATS-3/ (390px only).
- Open: STATS-3-F (review-3/4/5 lows, missing tests, seasons.rls.test.ts 5s timeouts when leaked workspaces exist).
- Owner: migrations 00061-00062 await the production push.
- Next: STATS-3-F after the owner's priority rows; STATS-4 is unblocked once STATS-3 merges to v3.

## PRICE-3: Real column + below-break-even badge
- `pricing-real.ts` rewritten (v1 PricingInputs path and fixed_fees/product_stats queries dropped); `realScenarioInput` pure + tested; Real column (4th) in pricing results; badge via `saleBelowBreakEven`; `resolveSettings` exported from pricing-v2.
- Removed the unused `real` prop from `scenario-engine.tsx` (never passed).
- Screenshots NOT taken (no browser session/login in this run): needs /verify ui-reviewer pass.

## PRICE-3 round 2 (review-1 fixes, D67)
- U1 overflow fixed (sr-only hint span removed from th; `relative` wrapper). Browser, 390px, AR+EN x light+dark: documentElement.scrollWidth = 390 = viewport in all four. Screenshots docs/design/audit/PRICE-3/r2-*.
- Q1 Real reads confirmation.value / delivery.value (+ own maturity flags); Q2 inputs rows + red below-break-even Real cells; Q3 USD/DZD cell with hint; U2 popover hint; U3 group labels stay sticky; U4 divider; Q4 RPC error throws to error.tsx; Q5 ceil.
- Known limits (D67 item 8): confirmed-then-cancelled-before-pickup not in either rate; delivery % can read slightly high with <=20% parcels on the road. Not done: Q6, Q7 (no decision, out of scope).
- PRICE-3 round 3: 390px screenshots EN dark and AR light (r3-en-dark-390.png overwritten by r3-*-390 final, r3-ar-light-390.png); ad-cost number now aligned with its column.

## PRICE-3 done (review-4 PASS)
- Done: Real column (4th) on the Pricing tab from kpi_summary via pricing-real.ts; below-break-even badge; zero-rate rows and final price fixed in review 4.
- Verify: scripts/gate.sh GATE OK on v3-PRICE-3 (645 passed / 3 skipped, live RLS suite; local DB reseeded by coordinator via db-reset.sh).
- Evidence: docs/briefs/PRICE-3.review-4.md PASS; screenshots docs/design/audit/PRICE-3/ and PRICE-3-r4review/.
- Owner: none.
- Next: PRICE-3-F (review-4 lows, missing tests); PRICE-4 unblocked.

## PRICE-4 — Portfolio view + CSV; BENZ retired (2026-11-19) — BUILT
- Done: `/app/pricing` portfolio (scenario toggle, 5 cards, totals, CSV) on `pricing-v2` via `src/lib/pricing-portfolio.ts`; BENZ engine/planner/v1 strings removed; `/app/products/planner` redirects.
- Removed: `scenario-engine.tsx`, `pricing-data.ts`, BENZ half of `pricing.ts` (P&L metrics kept), v1 tests, `pricing.*` messages.
- Screenshots: `docs/design/audit/PRICE-4/` (1280 + 390, dark/light, EN/AR; scrollWidth == viewport at 390 in all four). Empty and error states not screenshotted (no way to force them with seed data); missing-cost row not shown (all seed products have cost).
- Note: benz worst capital 173,700 needs worst ad cost typed as 2.70 (derived 2.71 gives 174,041); test fixture types 2.7.
- PRICE-4 r2: review-1 fixed (inactive excluded, CSV formula neutralised, capital column, chip slot, lows); screenshots r2-* (light/dark, AR/EN, 390/1280) checked.

## PRICE-4 round 4 done (review-4 PASS, D69)
- Done: `csv.ts` segment rule (`;`, tab, CR, LF start a new segment; formula-like segments get an apostrophe; wider quoting) with the 19 pinned outputs in `csv.test.ts`; no other file changed in round 4.
- Verify: `scripts/gate.sh` GATE OK on v3-PRICE-4 (680 passed / 3 skipped, live RLS suite).
- Evidence: `docs/briefs/PRICE-4.review-4.md` PASS; D69. Owner: Q-24 and D69 section 6 accepted limits (owner may overturn D69).
- Next: PRICE-4-F (reviews 1–4 lows, missing tests, 1,000-product cap, agent-redirect test, "Pricing calculator" sidebar label, Excel leading zero).

- STATS-2-F round 2: review-1 findings 1-9 fixed (unmatured marker = Info icon + sr-only reason; commune extras folded into the name cell; drill params share DRILL_PARAMS; banner label guarded). Screenshots via chrome-devtools: dark EN 1280 (table, unmatured markers) and light AR 390 (commune panel open) checked, no defects. Not shot: orders/all?drill=shipped banner, other theme/locale combos. #12 (Latin names in AR) still open.

## STATS-2-F — done (review-2 PASS)
- Done: STATS-2 review-2 lows and missing brief tests delivered on v3-STATS-2-F (commits 4a28fec..5d1a7a5).
- Verify: `scripts/gate.sh` GATE OK on v3-STATS-2-F (698 passed / 3 skipped, live RLS suite).
- Evidence: `docs/briefs/STATS-2-F.review-2.md` VERDICT PASS; screenshots noted in PROGRESS (STATS-2-F round 2).
- Owner: Latin names in AR (product question) still open per MASTER_PLAN.
- Next: merge to v3 by coordinator; no follow-up task queued here.

## STATS-3-F (v3-STATS-3-F)
- Done: orders bar (Clear all with dropped-only note, drill keys kept outside drill mode, chips on own row, remove aria, admins in agent lookup, repeated delivery_type dropped with note); Statistics `active` normalized (stale season / lone year not persisted, one Clear action on empty state); combobox + Seasons empty card layout; drill banner trim; pure helpers (`leaveDrillKeys`, `dropOneKey`, `stats-filter-edit.ts`, `seasonYearState`) with behavioural tests; RLS suite: 30s beforeAll, leaked-workspace cleanup, non-admin 0 rows, drill parity, direct-count checks.
- Screenshots (r2, chrome-devtools, `docs/design/audit/STATS-3-F/r2-*`): orders drill/dropped-only (dark EN + light AR, 1280 and 390), Statistics with filters (light AR 1280/390), Statistics empty state (dark EN 1280/390, light AR 390), Seasons empty cards (dark EN + light AR, 1280/390). `<html>` class and real width verified per shot (390 via emulate; plain resize floors at 500). Found: dropped-only 'Clear all' sat detached on its own row; now inline with the note. Empty state shows one Clear action (chip + button), no defects. Not shot: dark AR / light EN combos, Statistics with filters in dark EN, orders drill banner in dark AR.
- STATS-3-F merge: review-2 PASS verified; gate OK on v3-STATS-3-F (716 passed / 3 skipped, live RLS suite). Merging v3-STATS-3-F into v3 (no-ff).

## PRICE-3-F round 2
- Fixed review-1: Real "losing" now uses the drawn profit (`realDrawnProfit`); `maxAdCostUsd` impossible at c=0/ad=0 (adCostPerDelivered stays "alt": 0); `realBothZero` helper + test; `v!==0` guard keyed on `mode==="alt"`; test filter removed.
- Screenshots (chrome-devtools, `docs/design/audit/PRICE-3-F/`): c=0 ad=0 (dark EN 1280), both 0 ad>0 with footer line (dark EN 1280), both 0 ad=0 (light AR 1280), c=0 d null all missing and no footer (light AR 1280), d=0 (light EN 1280), normal (dark EN, window floored at 500 px: Real divider visible, Real column reachable by scroll). Real divider visible in dark and light. Edge data seeded as `P3F*` products locally; orders removed afterwards (stock_movements are append-only, so the P3F products remain: run `db reset` to clear them).
- Not shot: other theme/locale/width combos. Review-4 L5 (Real column off-screen at 390) still open, tracked.

## PRICE-3-F done
- Done: PRICE-3 follow-up delivered on v3-PRICE-3-F (review-2 fixes; ad-cost-0 both-rates-zero case, stray footer, both-zero line EN/AR, U4 divider, listed tests).
- Verify: `scripts/gate.sh` GATE OK on v3-PRICE-3-F (commit 3f7d7f0); local DB reset to 00063 and reseeded before run.
- Evidence: `docs/briefs/PRICE-3-F.review-2.md` VERDICT PASS; screenshots in `docs/design/audit/PRICE-3-F/`.
- Owner: none for this task.
- Next: review-4 L5 (Real column off-screen at 390 px) still open, tracked under PRICE-3.

## PRICE-4-F
- csv.ts untouched (D70); new csv/orders-row tests pin real behaviour. CSV: margin exported as percent, minPrice ceiling, 2-decimal rounding. Partial-totals warning at 1000 products. Tap target, icon chip, scroll-edge cue. Agent-redirect tests (pricing-guard.test.ts).
- Screenshots (chrome-devtools, 390 emulated + 1280; dark EN, light AR, dark EN desktop): scroll cue, icon chip, cards OK. Not captured: every theme x locale combo, empty state, partial warning (needs 1000 products).
- Left open: review-4 lows 1-2 (D69), accepted limits D69 (6). Observed: "-1 500,50" (comma decimal) gets an apostrophe, not pinned.

## PRICE-4-F done
- Done: PRICE-4-F follow-up delivered on v3-PRICE-4-F (CSV margin percent, minPrice ceiling, 2-decimal rounding, partial-totals warning, tap target, icon chip, scroll cue, agent-redirect tests).
- Verify: `scripts/gate.sh` GATE OK on v3-PRICE-4-F (commit 478dad8); 745 tests passed, 3 skipped.
- Evidence: `docs/briefs/PRICE-4-F.review-1.md` VERDICT PASS; screenshots noted above.
- Owner: none for this task.
- Next: the 1,000-product partial-totals warning and the non-captured theme/locale combos stay open for screenshot follow-up.

## PRICE-2-F — PRICE-2 follow-up (2026-11-19) — DONE
- Done: helpers `withTargetMode/closeFocusTarget/radioTabIndex/focusIdFor` in `pricing-form.ts` (unit-tested) and wired; reset focus only on keyboard activation (`e.detail === 0`); stale `didReset` cleared on dialog open; `nextApplied` pure logic so an invalid quantity only freezes the quantity (overrides/ads/price keep applying); per-field range / "not a number" messages; thousands separators (money inputs on blur, "Default:" placeholders); platform fee > 50% warning (still saves); tests: RLS audit INSERT/UPDATE/DELETE, cross-workspace product_id UPDATE, live `saveProductPricing` (`actions.live.test.ts`), AR PricingCell.
- Skipped (verified on screen): #10 AR chip wrap (no wrap at 390 px, chips 20 px high); #11 sticky group rows (table sits in an x-scroll container, group rows already stick horizontally). Review-4 #4 (focus token contrast) stays a design-system note.
- No jsdom/testing-library (unplanned dependency): helper tests + keyboard walk replace component DOM tests.
- Screenshots (chrome-devtools, 390 px): AR light product page; EN dark invalid quantity + final price override; EN dark settings fee warning. Not captured: 1280 px, EN light, AR dark, reset dialog Escape walk.
- Round 2 (review-1 FIX): `actions.live.test.ts` now owns its fixtures (two `pl-` workspaces, one admin, own products), cleaned through `test-cleanup.ts`, deletes only its rows; added `groupDigits`, `PLATFORM_PCT_WARN`, `rangeHint` kinds + en/ar key tests; cross-workspace UPDATE test pins error not null and 0 rows; number-field NBSP noted controlled-only. Dirty / `saveSnapshot` logic deliberately left in the component (behaviour verified on screen). #10 and #11 already fixed, verified on screen. Screenshots not re-captured this round (no UI change).

## PRICE-2-F merged (ship)
- Done: PRICE-2-F follow-up on v3-PRICE-2-F (focus helpers, nextApplied logic, range messages, fee warning, RLS/cross-ws/live action tests, AR cell test); task set to done.
- Verify: `scripts/gate.sh` GATE OK on v3-PRICE-2-F (766 passed, 3 skipped); `scripts/gate.sh --fast` re-run after merge into v3.
- Evidence: `docs/briefs/PRICE-2-F.review-2.md` VERDICT PASS.
- Owner: none.
- Next: review-2 lows (AR 1280 duplicate legend label) and non-captured screenshots (1280 px, EN light, AR dark) stay open.

## Run report — /auto 5 (2026-11-19, batch after PRICE-4)
- Shipped 5/5: STATS-2-F c5ca60a (review-2 PASS) · STATS-3-F c2ad69a (review-2 PASS) · PRICE-3-F ca68a74 (review-2 PASS) · PRICE-4-F 1aeb12f (review-1 PASS) · PRICE-2-F 2d637b9 (review-2 PASS).
- Decided by Claude (owner may overturn): D70 — PRICE-4 review-4 lows 1–2 are not built; `csv.ts` quoting unchanged, D69 pins hold.
- Open questions: Q-18 (CONF-1 search box) still needs the owner; the answered-by-default ones (Q-3 … Q-24) wait for a yes/no only.
- Blocked, unchanged: STORE-3 (merge needs owner OK) holds STORE-4/5; CONF-1 (Q-18) holds CONF-2/3/4.
- STATS-2-F added migration `00063_kpi_drill_shipped.sql` although its plan row had no `M`: local only; joins the owner's production push list (O-2).
- Screenshot matrices are partial on all five tasks (missing combinations listed in each task's PROGRESS note and review file); reviews passed with that filed as low.
- PRICE-3-F ship gate failed once (`seasons.rls.test.ts`, leftover local test products); `scripts/db-reset.sh` on v3, then GATE OK. No code change.
- Plan order: `analyse` passed over STORE-7 (todo, dep STORE-2 done, has `M`) for PRICE-2-F without giving a reason — check before the next pick.
- Next `/auto`: STORE-7 if eligible, else STORE-1-F, STORE-2-F, ORD-1-F, P1-7-F.

## STORE-7 — reviews + size guide blocks (2026-11-19) — built, awaiting /verify
- Done: `reviews` table (00064, admin-only RLS), size guide + reviews blocks (max one each), cost-free DAL with verified rule and 60-cap, public sections (table, cards, rating line), review status kind, admin Store > Reviews page, editor size grid. Actions check row counts and invalidate the public cache. Q-25: no public submission.
- Screenshots: only `/app/store/reviews` (EN, dark, no-store empty state, nav active) captured. Not captured: populated list, form, editor, preview and public page at 390/320/1280, light, AR, keyboard pass (needs a seeded live store and page).

## STORE-7 review-1 FIX round 2 (2026-11-19)
- Tests added: publicReviewName separators (hyphen, dot, NBSP, ZWSP, long token), emoji-only + verified-flip + >1000 ratings (live DAL), admin-session cross-workspace insert (live RLS), order lookup `workspace_id`/`order_seq` filters, render tests (size guide hides empty columns; reviews block with 0 approved / no block renders nothing). Not added: preview-equals-public (admin session client) test.
- #7: reviews of products without a store page stay listed with a "No store page" label. #9: gold on white = 3.48:1 (light), dark gold on dark surface higher; no outline needed.
- Screenshots (local seed: store luxe-demo, page with size guide + reviews, 12 reviews incl. 1000-char Arabic, hidden, orphan; in `docs/design/audit/STORE-7/`): reviews list EN dark 1280, AR light 390, public page 500 px (window floor, 320 not reachable) AR, public light reviews, editor EN dark 1280. Fixes from them: approve switch no longer shows a visible long label (aria-label only); review cell min width so the 390 px table scrolls instead of crushing text; review body `dir="auto"` so French punctuation sits correctly in RTL.
- Not captured: EN light/AR dark admin combos, preview, full keyboard pass, true 320 px.

## STORE-7 review-2 FIX (2026-11-19)
- Fixed: admin list stacks into cards below `md` (switch + Delete visible at 390 px, no horizontal scroll); `.store-note` `dir="auto"`; summary count/avg only count reviews that render (matches cards); `publicReviewName` splits on any non-letter; `DeleteButton` is a discriminated union, action path refreshes in place and shows the error (logic in `runDelete`); order number in `<bdi>`; switch hit area enlarged (before:-inset-2.5).
- Tests added: name separators, count==items with an emoji-only review, preview equals public (admin session vs service client, live), `runDelete` failure, `dir="auto"` render. Not unit-tested: `<bdi>` on the admin order link and 390 px reachability (async server page, no jsdom): verified on screen (switch x=115, scrollWidth 390, 12 rows).
- Screenshots (chrome-devtools emulate, true viewports, `docs/design/audit/STORE-7/r3-*` + refreshed `public-320.png`): admin list AR light 390; public 6-column size guide AR light 320 (table scrolls, note LTR); public AR light 1280 size guide + reviews; admin preview (9 cards, 4.3 · 9, equals public); admin empty states no-match / none / no-pages, error (EN dark 1280); keyboard Tab switch -> Delete at 390. Local review/store_pages rows were backed up and restored for the empty/error shots.
- Accepted/noted (low #8): verified mark up to 120 s stale; createReview accepts a product without a store page (list labels it).

## STORE-7 — done (2026-11-19)
- Done: reviews table (00064, admin-only RLS), size guide + reviews blocks, cost-free public DAL, admin Store > Reviews page, editor size grid. Reviews of products without a store page are labelled, not hidden.
- Verify: review-3 `VERDICT: PASS` (risk high, surface ui,security). `scripts/gate.sh` GATE OK (797 passed, 3 skipped).
- Evidence: screenshots in `docs/design/audit/STORE-7/`, EN/AR, light/dark, 390 and 1280 px; true 320 px public page checked in review-2.
- Owner: none open from STORE-7. Known: verified mark may be up to 120 s stale (accepted, low).
- Next: next `todo` task in docs/MASTER_PLAN.md.

## STORE-1-F (2026-11-19)
- Done: migration 00065 (advisory lock in the completeness trigger, deletes before upserts so a label can be removed and re-added in one save, `incomplete size` refusal for a new size mapped to `invalid`), tests (re-add label, empty values, size change at wait_for_deposit), workspace deletes via `deleteWorkspaces`, Size card next to the order summary with a "Size" label, option fallback names, unsaved hint, product Save hint, new-product notice, "Now:" count label, no-wrap count-needed pill, `rls.test.ts` D9/D10 picks a not-yet-delivered order (was flaky).
- Not done: order breadcrumb (PageHeader has no breadcrumb support). Two-writer race not reproducible in a test (reasoning only). At wait_for_deposit nothing is held in stock (reserved is derived), so the test asserts no stock change and the label rewrite.
- Screenshots (chrome-devtools emulate, true 390 px, `docs/design/audit/STORE-1-F/`): order EN dark, order AR light, product edit AR dark (unsaved hint, unnamed-option labels), count-by-size EN light, stock hub EN dark, new product EN light. No 1280 or remaining theme/locale combos captured. No overflow (scrollWidth 390) on all.

## STORE-1-F review-1 + review-2 FIX (2026-11-19)
- Review-1: 00066 (zero options refused, `values` object only, option set fixed once any size exists) + tests, reserved-stage assertion, test split.
- Review-2: 00067 (deferred trigger refuses a value-less size from a signed-in user; value must belong to its option) + tests; editor uses `optName` everywhere, `dirty` hoisted, unsaved hint is `text-muted-foreground` (contrast safe); `workspaces.delete` in order_seq and zrexpress-sync tests now `deleteWorkspaces`; test renamed; DB.md updated.
- Accepted: 40P01 window between a product delete and a save (low #2): no delete-product action exists in the app, so it is only reachable by direct DB access. Follow-up task to log: revoke TRUNCATE/TRIGGER/REFERENCES from `authenticated` on the four variant tables.
- Not done: the full dark/light x EN/AR x 1280/390 screenshot set (only partial 390 sets exist).

## STORE-1-F done (2026-11-19)
- Done: review-3 PASS (risk high, surface ui,security) merged to v3 after the follow-up fixes listed above; task set to done.
- Verify: `scripts/gate.sh` GATE OK on v3-STORE-1-F before merge (804 passed, 3 skipped).
- Evidence: partial 390 px screenshots in `docs/design/audit/STORE-1-F/`; full dark/light x EN/AR x 1280/390 set not captured.
- Owner: none. Accepted low: 40P01 window between product delete and save (no delete-product action in app).
- Next: follow-up task to revoke TRUNCATE/TRIGGER/REFERENCES from `authenticated` on the four variant tables; next `todo` task in docs/MASTER_PLAN.md.

## STORE-2-F (v3-STORE-2-F)
- Done: data errors throw, linkPageProduct publish guard, createStore loser delete check, liveStoreSlugs paginated, app not-found role home + title, editor root text-start, tests.
- Verified on `next start`: `/s/nope/xx` returns 404 but the initial HTML has NO `<h1>` (html id=__next_error__, content only in the RSC payload, applied on the client). Tried a `[store]/not-found.tsx` and moving the guard into page.tsx: no change (page.tsx loses the 404 status). Unresolved, needs an owner/analyse follow-up. No stack paths seen in the payload.
- Not verified (no logged-in browser session): 1280 px store layout, AR editor screenshots, agent HTTP test, store-http.test.ts against `next start`.

- STORE-2-F review 1 FIX: linkPageProduct/createStore/editor fail closed on read errors (+TOCTOU status guard); live RLS test for store_pages cross-workspace; stronger pagination/cache-tag tests. NOT fixed: store 404 `<h1>` in initial HTML. Tried page-level notFound, not-found at [store]/[slug], moving the root layout to (store)/layout, force-dynamic: every variant on `next start` still returns the `__next_error__` shell (404 status, content only in the RSC payload). Needs owner/Next-level decision. Not done: screenshots, agent HTTP test (no browser/session run in this pass).

- STORE-2-F review-1 second pass (findings 1, 3, 4). Finding 1 is a framework behaviour, not our code, so code is unchanged. Evidence: on `next build && next start` (Next 16.2.11) `/s/nope/xx` gives 404 with `<html id="__next_error__">` and an empty body. The server log is clean; the RSC payload carries only `E{"digest":"NEXT_HTTP_ERROR_FALLBACK;404"}` and the real not-found UI (h1 included) sits in the payload. Source: `node_modules/next/dist/server/app-render/app-render.js` `getErrorRSCPayload` (about line 1089 to 1130) seeds `createElement('html',{id:'__next_error__'}, head, body[empty])` whenever a `notFound()` escapes the first render ("For metadata notFound error there's no global not found boundary on top so we create a not found page with AppRouter"). Reproduced in a bare throwaway Next 16.2.11 app (single root `layout.tsx`, root `not-found.tsx`, a page that only calls `notFound()`, with and without `force-dynamic`, also as Googlebot): same empty-body shell. Also reproduced with `experimental.globalNotFound` off, in dev, in `(app)`, and with a segment `not-found.tsx` at every level. Docs: `01-app/02-guides/streaming.md` "The HTTP contract" and `03-file-conventions/not-found.md` only describe the status code (404 vs streamed 200 + noindex) and do not promise server-rendered not-found markup. The status (404), `noindex`, and `<title>` are in the initial HTML; the h1 arrives with the payload. No fix possible without leaving `notFound()` (e.g. returning a 404 `Response` from a route handler); owner decision.
- Finding 3: added the agent/admin session HTTP test to `src/lib/store/store-http.test.ts`. Ran it plus the existing store-http tests once against `next start -p 3100` with a seeded local store/page: 4/4 passed. Note: agent on `/app/store` and `/app/store/pages/<id>` gets HTTP 200 (streamed behind loading.tsx, per the streaming doc) with the 404 digest and noindex in the payload and no admin h1; the test asserts exactly that. Caveat: `next start` serves a 404 from the on-disk ISR/data cache after a first miss (store slugs cached 120 s) - clear `.next/cache/fetch-cache` and `.next/server/app/s/<store>` when re-seeding.
- Finding 4: screenshots taken with chrome-devtools MCP (admin seed user) into `.next/shots/` (not committed): store hub (dark, EN), page editor (dark, AR, RTL correct), app not-found in the shell (light, AR, role home button), `/s/luxe/<slug>` 1280 px light and 390 px dark (RTL, burgundy, fine; product photo is an unreachable external URL so the broken-image icon shows). Not taken: agent-session app not-found (needs a second login), EN editor, light hub. Store follows OS colour scheme (dark under OS dark), unchanged.

STORE-2-F round 3 (review 2): app not-found title now set by `DocumentTitle` (Next 16 ignores segment metadata) plus `/app/[...rest]` catch-all so `/app/zzz` shows the app not-found; store dead-link HTTP test added per D78; store gallery capped and columns 5:6 at 860px+. Screenshots in docs/design/audit/STORE-2-F/ (store 1280 light, 390, app not-found AR dark / EN dark, editor 404 EN light). Not captured: AR editor, hub error state, agent not-found (no agent session in the browser); the 1280 product page shows the sold-out size, no order form (seed data). Findings 5 to 8 left for a later pass.

STORE-2-F round 4 (D79): agent HTTP test now reads title and slug with the admin session, throws on a missing page or empty title/slug, asserts absence of title and slug (the page-id check is gone); dead-link test name says D78; `.store-top` back to two equal columns (gallery cap kept); `getStore` orders by `created_at, id`. Local demo page made in the local database only: the `luxe` page's product has two https photos (picsum.photos), size M with 7 in stock (by a stock movement) and size L at 0. `store-http.test.ts` run against `npm run build` + `next start -p 3100` with STORE_E2E_URL, STORE_E2E_PATH=/s/luxe/abaya-fresh and the local Supabase variables: 5 passed, 0 failed. Screenshots (D79 f): NOT taken, no browser tool was used in this session; the round-3 `store-page-390.png` and `store-page-1280.png` (broken image) are still the old files and must be re-shot. Left for STORE-2-G: review-3 lows 5 to 10 and missing tests, photo-failure placeholder, dead-link store-name check, gallery cap viewport rule.

STORE-2-F round 4 screenshots (D79 f), chrome-devtools MCP, local stack (dev server :3000), `html` class and `lang` checked before each shot, photos `naturalWidth` 800 on the store shots. Captured in docs/design/audit/STORE-2-F/ (`r4-*`): editor AR dark 1280 (admin); app not-found AR light 1280 and AR dark 390 (admin); store hub error EN dark 1280 and AR light 390 (admin; made by renaming `store_pages` locally, renamed back, row count checked); agent (confirmation@seed.mnw) not-found EN dark 1280 and AR light 390; store page `/s/luxe/abaya-fresh` AR light 1280, light 390, dark 390 (OS scheme emulated, two columns, no sideways scroll, gallery photo fine). The broken-image `store-page-390.png` and `store-page-1280.png` are deleted (replaced by the `r4-store-page-*` files). Not captured: EN store shots (store is Arabic only, D79 d/f). No code change: no screenshot showed a defect on a STORE-2-F screen. For STORE-2-G: dev-mode N indicator overlaps the sidebar user block; "Store settings" nav item and the editor's unlink link look dimmed; empty space under sizes at 1280 is the hidden order slot (STORE-4).

## STORE-2-F done (2026-11-19)
- Done: review-4 PASS (risk high, surface ui,security); round-4 code and tests (agent HTTP test, D78 refs, equal columns, getStore tie-break) merged to v3; task set to done.
- Verify: `scripts/gate.sh` GATE OK on v3-STORE-2-F (815 passed, 5 skipped).
- Evidence: screenshots in docs/design/audit/STORE-2-F/ (r4-*); store-http.test.ts 5/5 against `next start` (local stack).
- Owner: store 404 `<h1>` missing from initial HTML is a Next framework behaviour; needs an owner decision (see round 1 notes).
- Next: STORE-2-G (review-3 lows 5 to 10, missing tests, photo-failure placeholder, EN store shots not taken).

ORD-1-F: sticky frozen cell now paints its own inset ring when the row is current and the table focused; CSV "Order" header uses `fields.order` (the brief's `orders.col.order` does not exist; `fields.order` exists in en and ar); `db-reset.sh` prints `PostgREST not ready after 30s` and exits 1. Error-path test: no pure seam (decision is inline at orders/all page.tsx:156), no refactor per brief, so the check stays browser-only (no DOM env, D55; `?product_id=x` checked in ORD-1 round 4).

ORD-1-F browser pass (chrome-devtools MCP, local dev :3000, admin and confirmation@seed.mnw). Real `press_key Tab` from the control before the table lands on the table (activeElement TABLE); ArrowDown makes exactly one row current (one tr ring, one sticky-td ring) on orders/all, delivery and product orders. Checked: EN light/dark, AR light/dark, scrolled sideways (ring intact over the frozen cell), 390 px (skeleton then table, no overflow), row click AND Enter both open the order sheet (review-3's "sheet does not open" no longer reproduces), Escape closes it, order page AR light, agent session (orders/all redirects the agent to the confirmation queue, `#0001` listed). Defect found and fixed: after Escape the command palette dropped focus to BODY (no Radix trigger); `command-palette.tsx` now restores focus to the previously focused element (verified: Search button). Still open, not fixed: Escape from the order sheet also leaves focus on BODY (not the table row); hover-on-row shot not taken (hover tool not available). Screenshots: docs/design/audit/ORD-1/f-* (all-en-light/dark, all-ar-light/dark focus, scrolled, 390, delivery, product-orders, order sheet click/Enter, order page, agent, palette).

## ORD-1-F done (2026-11-20)
- Done: review-2 PASS (VERDICT: PASS, surface ui); focus ring across frozen column, real Tab walk, command-palette focus restore, CSV header translated; task set to done.
- Verify: `scripts/gate.sh` GATE OK on v3-ORD-1-F (815 passed, 5 skipped).
- Evidence: screenshots in docs/design/audit/ORD-1/f-*; browser pass in the entry above.
- Owner: none for this task.
- Next: open item from the browser pass: Escape from the order sheet leaves focus on BODY, not the table row (not fixed).

P1-7-F: parser hardening (invalid home fee never promotes a second home label; colon-less part warns; strict numeric regex; third label keeps first stop-desk price), swapOrder safeParse (+ stopped reason via wilaya_fees lookup, no migration), switchOrderToHome guards with translated keys, loadStoredFees returns an error on a failed read, commune-only apply summary (diff lists added/removed names), MoneyField keeps a typed 0 visible, order-form error clears on edit and is not duplicated, a11y names, bdi, ICU plural for warnings. Browser pass (chrome-devtools, local :3000, admin): Delivery fees grid refused-0 case (dark, EN: 0 stays shown, error under grid, nothing saved) and new-order form (AR, dark). Not done: light theme, 390 px (viewport emulation reset on navigation), swap card refused/success shots, CSV commune-only preview shot (no fixture file); covered by unit tests only.

P1-7-F round 2: order-form error now clears on any field edit (form-level onChange plus quantity stepper clicks; verified: AR dark 390, error gone after typing a name). Screenshots (chrome-devtools, local, admin, theme/locale via cookies) in docs/design/audit/P1-7-F/: swap card on returned order #0045 (light EN/AR 1280, dark EN/AR 390, light AR 390 refused = pick a wilaya error) and order-form error (light EN, dark AR 390, cleared dark AR). Not taken: CSV commune-only preview (no fixture file), fees grid at 390, swap success (would create a real order), light 1280 grid beyond the existing shot. Lows 3-8 of the review not addressed this round.

P1-7-F round 4 (D84): parser now splits each Custom_rates part on the FIRST colon; a part is priced only as label, one colon, one number (no digit `\p{Nd}` in the label, number must match `^\d+(\.\d+)?$`); `home:1350:720` and `home 1350:720` give a `malformed_row` warning and no price, kind still read so a later home label is never promoted. Five tests added in the "hostile fee parts" block; no existing test changed. Screenshots (chrome-devtools MCP, local DB, theme/locale cookies, `<html>` class/lang and innerWidth checked before naming) `docs/design/audit/P1-7-F/r4-*`: fees-refused-zero (EN light 1280, AR dark 390), csv-preview-communes and csv-toast-communes (EN dark 1280, AR light 390), swap-refused-stopped (EN light 1280, AR dark 390; Béjaïa stopped, server reason on screen), swap-success (EN dark 390, AR light 1280). Removed `settings-light-en-1280.png` (dark Settings overview) and `swap-refused-light-ar-390.png` (theme unchecked). Notes: the AR 390 fees shot hides the middle wilaya cards in the DOM (58 tall cards put the reason 15000 px below the 0); the stopped wilaya was switched via SQL on the local DB and restored, not through the grid; the Next dev-tools button was hidden in the two swap-success shots because it covered the card text; the toasts were captured during their fade-in and look translucent (shared toast, not touched). Round trip: unchanged sheet applied, commune-only copy (Timekten removed, Zzz Testville added) previewed and applied, original re-applied; a new preview of the unchanged sheet shows 0 changed and Apply disabled. Local DB now holds two extra swap orders (#0068, #0069).
"1 Issue" badge (d): not an app error. Chrome DevTools issues on the order page, no console errors: "No label associated with a form field" (5), "An element doesn't have an autocomplete attribute" (1), "A form field element should have an id or name attribute" (2). They appear before and after both refusals (client "Choose a wilaya", server "stopped") and also without opening the swap card; the swap card's wilaya Field has no htmlFor (review-3 low 8). Not caused by a file this round changed; goes to the P1-7-G follow-up, no fix here.

P1-7-F done (2026-11-20, review-4 PASS, D84): parser splits each Custom_rates part on the first colon; priced only as label (no digit, `\p{Nd}`), one colon, one number; otherwise one malformed_row warning and no price, kind still read so a later home label is never promoted.
- Done: round 4 fixes, five "hostile fee parts" tests, r4-* screenshots (10) in docs/design/audit/P1-7-F/; task set to done.
- Verify: `scripts/gate.sh` GATE OK on v3-P1-7-F first run (839 passed, 5 skipped); seasons.rls not failing this run, so no rerun needed.
- Evidence: docs/briefs/P1-7-F.review-4.md (VERDICT: PASS, qa-reviewer + ui-reviewer).
- Owner: none for the merge (D84 gate condition met).
- Next: P1-7-G (lows, ZR-swap outside item, missing tests from review-4 and review-3).

## STORE-1-G
- 00070 (revoke truncate/trigger/references, immutable variant-values trigger, value-less size guard); tests in variants.rls.test.ts; stock-stages 00029 re-run scoped to workspace; DB.md updated.
- i18n option names ("Option {n}" / "الخيار رقم {n}", templates drop the noun); stock level chip nowrap; order Size cell hidden only when admin size card shows; wilaya code/name explicit order; VariantsFeedback + order-meta extracted with rendered tests.
- Screenshots (chrome-devtools) complete in docs/design/audit/STORE-1-G-ui/ (20 files): order EN/AR light+dark 390/1280 + EN agent 390; product edit with unnamed option EN/AR x light/dark x 390/1280; stale message EN light 1280 + AR dark 390; stock EN dark, EN light, AR light at 390 with low/out/Count-needed chips on one line. Fix round 1: 00070 update/upsert tests now prove the trigger (verified failing with it disabled); removeValue keeps its noun; null wilaya code no dash.
- Fix round 2: option buttons read "Remove option {name}" / "Move option {name} up|down" for named options, separate Unnamed keys for the fallback (EN+AR, tested). Low and out chips at 390 px: `docs/design/audit/STORE-1-G-ui/stock-en-dark-390.png`, `stock-en-light-390.png` (EN), `stock-ar-light-390.png` (AR). Lows 3-8 not done this round.

## STORE-1-G done (2026-11-20, review-3 PASS)
- Done: review-3 PASS (VERDICT: PASS, qa-reviewer + ui-reviewer, all findings low); migration 00070 kept (00068/00069 taken by parked v3-VAR-1 and v3-CHART-1); task set to done; lows and missing tests of review-2 and review-3 moved to STORE-1-H (todo).
- Verify: `scripts/gate.sh` GATE OK on v3-STORE-1-G (856 passed, 5 skipped). Brief asked for fast gate green 3 runs in a row: not repeated at ship, so that is not verified here.
- Evidence: docs/briefs/STORE-1-G.review-3.md; screenshots docs/design/audit/STORE-1-G-ui/.
- Owner: before a remote `db push`, run the 00070 guard's `count(*)` on the remote; the migration aborts if value-less sizes exist (00067 still exempts service_role).
- Next: STORE-1-H (follow-up lows and missing tests from review-2 and review-3).

## STORE-2-G
- Tests: invalidate busts store-public; hub/pages list throw on DB error; error.tsx reason+retry (EN+AR); ws2 agent RLS; publish/link eq filters; catch-all notFound; DocumentTitle unmount/pathname; StorePhoto (hook-harness, no jsdom in repo).
- Fixes: publish UPDATE filters product_id (0 rows -> needs_product); assertPublishable, publish read and preview throw on DB error; DocumentTitle guard; StorePhoto placeholder (gallery, related, image block); `.store-top` align start; Unlink hidden while published (hint contrast 7.2 dark / 7.1 light); sidebar scrolls the active row clear of the edge fade (the "disabled" Store settings was the D33 bottom fade over the active item at <=800 px height).
- Screenshots (chrome-devtools): docs/design/audit/STORE-2-G/ (store light/dark 390/1280 working + broken image; editor AR light/dark; sidebar EN/AR light/dark at 720 px; hub error EN dark; agent not-found EN dark). The store is Arabic-only (never reads the locale), so no EN store shots. Local demo store "luxe" recreated with picsum https photos (DAL accepts https only, so a local /public file cannot be shown); local DB only.
- Logged, not built: advisory-lock createStore race and DB trigger for deactivated linked product (need migration + DECISIONS row). Store-http "luxe modesty" grep untouched. Sold-out block stays STORE-3.

STORE-2-G review 1 FIX: tests added for DoD 4 (draft link), 6 (publish with zero rows updated), 7 (read errors throw in publish, assertPublishable, link); StorePhoto now exports `imageFailed()` (the before-hydration check) with unit tests plus a server-render test. No DOM library is installed (jsdom would be a new dependency), so a real client mount is not tested; the placeholder after a failed load was seen live in the browser (veste page). Image block alt text is now the placeholder label. Screenshots re-shot with locale in the name: `store-{veste-broken,jupe-ok}-ar-{390,1280}-{light,dark}.png` (8 files, store is Arabic-only so no EN), before-fix shots removed. `.store-buy` next to hidden `#order` visible at 1280. Not shown: a related-card placeholder (the demo pages have no related products). Not done: review lows 4-8, hint contrast measurement.

## STORE-2-G done (2026-11-20, review-2 PASS)
- Done: review-2 PASS (VERDICT: PASS, qa-reviewer + ui-reviewer, all findings low); task set to done; the six review-2 lows and review-1 lows 4–8 moved to STORE-2-H (todo).
- Verify: `scripts/gate.sh` GATE OK on v3-STORE-2-G (876 passed, 5 skipped).
- Evidence: docs/briefs/STORE-2-G.review-2.md; screenshots docs/design/audit/STORE-2-G/.
- Owner: none.
- Next: STORE-2-H (lows from review-2 and review-1 4–8); STORE-3 expects a `.store-top` merge conflict (review-2 low 6).

## P1-7-G (build)
Review-4 lows closed: Nd regex, pushToZR swapped guard + card hide, swap-card label/chevron, Combobox `id`, CSV hint bdi, switch-home tests, csvSuccessToast helper. Browser pass (chrome-devtools): swap card closed/open at 1280 dark and 390 (theme emulation did not flip the app's own theme, so light not verified); chevron rotates (rotate: 180deg when open); label tied to trigger. Swapped-order screen not captured: DB guard blocks writing swapped_to_order_id outside swap_order (covered by unit test). Order-history "< 1m" bidi left (formatter not in this task's files). Tests skipped: oversize fee / home:0.001 (parser has no such rule).

P1-7-G browser pass completed (chrome-devtools): files in `docs/design/audit/P1-7-G/` named screen-locale-theme-width. Swap card closed/open EN+AR x light+dark x 1280+390 (16 shots; html class checked before each, theme via the `theme` cookie the app reads, no media emulation; chevron rotates open). Real swap done through the card on local returned order #0045 (-> #0084, local DB only): the original then shows "Swapped to order" and no ZR Express card/send row (`swapped-no-zr-send-en-light-1280.png`). Arabic CSV dialog (light 1280, dark 1280, dark 390). Fix from shots: at 390 the hint's parentheses sat outside the LTR `bdi` and mirrored/split ("Area,)" ... "(Rate_or_extra"); parentheses moved inside `<cols>` in en+ar `formatHint`. Still seen, left: AR history "< 1m" renders as "1m >" (formatter not in this task).

- P1-7-G fix round 1: swap guard now state-based (delivery_status), fee parser rejects >2 decimals / >=1e10, CSV hint is a block LTR line (AR 390 shot retaken, reads in order; theme shown was the app default, not re-toggled). `< 1m` bidi deferral stands.

## P1-7-G done (2026-11-20, review-2 PASS)
- Done: review-2 PASS (VERDICT: PASS, qa-reviewer + ui-reviewer, all findings low); task set to done; the 7 review-2 lows and the still-open review-1 lows (L1-L3, notes L4-L6) moved to P1-7-H (todo).
- Verify: `scripts/gate.sh` GATE OK on v3-P1-7-G (891 passed, 5 skipped).
- Evidence: docs/briefs/P1-7-G.review-2.md; screenshots docs/design/audit/P1-7-G/.
- Owner: none.
- Next: P1-7-H (lows from review-2 and review-1 L1-L3).

## Run report (2026-11-20, /auto 5)
- Shipped 5: ORD-1-F `8971b68`, P1-7-F `a1c3415`, STORE-1-G `196da9c` (migration 00070), STORE-2-G `b740ee2`, P1-7-G `e1ca2f3`.
- Parked 1: CHART-1 `blocked:Q-28`. Built on `v3-CHART-1`, gate OK, review-4 ESCALATE with no high and 3 mediums (far-future order lifts the 366-day cap, Finance no-costs empty state never shown, cost-bar table view has no drill links). Its migrations 00068 + 00069 clash with `v3-VAR-1`'s 00068; the second to merge renumbers.
- Decided by Claude (owner may overturn): D83 the profit waterfall is removed from Finance overview too and CHART-1 got a 4th round (Q-27); D84 P1-7-F got one last narrow round, merge only on PASS (it passed).
- Open questions: Q-28 CHART-1, Q-26 VAR-1, Q-18 CONF-1; STORE-3 also waits for the owner's merge OK. Phone push was not delivered (Remote Control inactive).
- Owner before a remote `db push`: run the 00070 guard's count on the remote; the migration aborts if value-less sizes exist.
- Gate: intermittent live-DB failures (`seasons.rls.test.ts`, `kpi.test.ts`), green on rerun each time; logged as TEST-2. The review step twice returned before its reviewers finished; the coordinator assembled `P1-7-F.review-4.md` and `STORE-1-G.review-2.md` from their reports.
- Follow-ups added: P1-7-H, STORE-1-H, STORE-2-H, TEST-2.
- Next `/auto`: first eligible `todo` in plan order (P1-7-H, STORE-1-H, STORE-2-H, then CARRIER-0-G, SEC-1-G, NAV-1-G, NAV-2).

## P1-7-H build notes (round 2)
- Review-1 fixed: link-only branch now runs right after the credentials read, before the wilaya/commune, phone and `wilaya_fees` guards (create path only keeps them); tests for unpriced/missing-field link, finder throw, 23505, other insert error, `zrSendState` swap, card `swapped` reason (role-based button match).
- Brief: `delivery-prices.ts` Unicode-digit strip deleted as dead code; the `${HOME}٣|${HOME}:500` test stays as a pin.
- Screenshot self-critique (chrome-devtools, 390 px, admin seed): CSV import hint EN dark and AR dark wrap cleanly, no horizontal overflow (scrollWidth = innerWidth). ZR card swapped reason on order #0045: AR dark and EN light read correctly. Not shot: CSV hint in light, ZR `status` reason (same component and layout as swapped), AR light.
- Pre-existing (note only): unconfirmed order shows `canSend` true; server refuses in English.

## P1-7-H done (ship)
- Done: follow-ups from D84 2e (ZR link-only before create guards, exact refusal strings, card `canSend` predicate, CSV `\p{Nd}` pin, decimals and malformed-row tests) merged from v3-P1-7-H.
- Verify: scripts/gate.sh GATE OK (tsc, 912 tests, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/P1-7-H.review-2.md VERDICT: PASS; screenshot pass noted above (not shot: CSV hint light, ZR status reason, AR light).
- Owner: none for this task. Pre-existing note: unconfirmed order shows `canSend` true; server refuses in English.
- Next: STORE-1-H, STORE-2-H, then TEST-2 (intermittent live-DB failures).

## STORE-1-H build notes
- Tests: guard test asserts reported count == pre-count + 1 and nothing left behind; clean-data guard case; `spare` size deleted at test end; anon/PUBLIC lack TRUNCATE/TRIGGER/REFERENCES. The `saveVariantConfig` action needs a session mock, so that test stays a schema test and is named "zod (schema only...)".
- Real `showsSizeCell`, `StockLevelChip` (`stock/stock-level-chip.tsx`) now exported and tested; VariantsEditor rendered with "" and "  " names (EN+AR); `as never` replaced by `satisfies VariantResult`. Editor: option name trimmed, unnamed input has `placeholder`.
- Screenshot self-critique (chrome-devtools, docs/design/audit/STORE-1-H-ui/): product edit EN light 1280 full page; stock hub 390 EN light and AR dark with Out (0) and Low (3) chips, each chip one line (height 20); unnamed option EN 390 light shows placeholder "Option 1". Local seed stock reverted via correction movements, temp product deleted. Not shot: stock EN dark, AR light. Observed (out of scope): empty value input has no placeholder.

STORE-1-H review 1 FIX (round 2): findings 1-6, 8, 9 fixed; 7 left (optional; showsSizeCell and showsCard match, showsSizeCell is already unit-tested). New `products/actions.test.ts` calls `saveVariantConfig` and asserts `{ok:false, code:"invalid", error:"variant_values"}` with no RPC and no client created (the old "needs a session" note was wrong). Stock chip test now uses `en.stock.*`; chip label wrapped in `<bdi>`. Guard test: one repeatable-read psql call, one bare size in each of two workspaces (pre + 2), clean case scoped to a fresh workspace with no deletes, asserts guard has `raise exception`; spare delete in finally. Value input placeholder "Value"/"القيمة" (new key `variants.valuePlaceholder`). Screenshots added (chrome-devtools, 390): stock-390-en-dark, stock-390-ar-light, value-placeholder-390-ar-dark (placeholder lab L 67.5 on L 3.7, well over 4.5:1). Seed stock has no Out/Low rows, so those stock shots show no chips (chip layout covered by the earlier AR dark shot). Not shot: unnamed option EN dark.

## STORE-1-H done (ship)
- Done: STORE-1-G review-2/3 lows fixed (guard count and clean-data tests, exact grant checks, `showsSizeCell`/`StockLevelChip` tests, whitespace option trim, value and option placeholders, `satisfies VariantResult`).
- Verify: scripts/gate.sh GATE OK (tsc, 923 tests 5 skipped, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/STORE-1-H.review-2.md VERDICT: PASS; screenshots in docs/design/audit/STORE-1-H-ui/.
- Owner: none. Not shot: unnamed option EN dark.
- Next: STORE-2-H, then TEST-2 (intermittent live-DB failures).

## STORE-2-H build notes
- Done: `StorePhoto` skips the mount check for lazy images and takes `onFail`; new client `Gallery` (`gallery.tsx`) drops broken slides (alt keeps original n of total) and shows one placeholder only when all fail; `DocumentTitle` depends on `usePathname()`; `linkPageProduct` throws on a page read error; published-page hint uses new `store.pages.unlinkLocked` key (en+ar); RLS ws2 inserts assert `42501` and pageB title unchanged (live suite run, 8 passed); tests for photo, document-title, gallery, actions, preview page.
- Screenshots (chrome-devtools, `docs/design/audit/STORE-2-H/`, html lang ar / dir rtl): gallery with one broken non-first image (AR light+dark, 390 and 1280; failed slide gone, related card with broken image keeps 4/5 height next to a working card); all broken (AR light+dark, 390 and 1280: one placeholder); editor with published page and hint (AR light+dark, 1280; muted token text readable). Local demo data (temp product/page, images) reverted. Not shot: related-card shot is 390/1280 inside the full-page captures only for the one-broken scenario.
- Conflict note: `.store-top` (store.css:46) is not touched here; STORE-3 edits the same line, expect a merge conflict there.
- Deviation: editor-hint light shot toggled the `light` class on `<html>` by script (no theme switch clicked).

## STORE-2-H done (ship)
- Done: STORE-2 follow-ups (lazy-image mount check, document-title path dependency, linkPageProduct throws on read error, unpublish hint key, ws2 RLS 42501 asserts, gallery collapses broken slides, preview page tests) merged from v3-STORE-2-H.
- Verify: scripts/gate.sh GATE OK (tsc, 932 passed 5 skipped incl. live RLS suite, i18n parity, color lint, build, protected paths).
- Evidence: docs/briefs/STORE-2-H.review-1.md VERDICT: PASS; screenshots in docs/design/audit/STORE-2-H/.
- Owner: none. Not shot: related-card placeholder only inside full-page captures for the one-broken case.
- Next: TEST-2 (intermittent live-DB failures); STORE-3 expects a conflict at store.css `.store-top`.

## CARRIER-0-G screenshot pass
Chrome-devtools: /app/statistics at 390 (AR, dark + light; EN not captured, session locale was AR; window min width rendered 500) with a focused map cell, focus ring visible; /app/dashboard scrolled, filter bar static and scrolled away; /app/statistics at 1280, no regression. 58 cells focusable. Table scroll fade in AR not separately captured. Follow-up: wilaya Arabic names need a migration (no name_ar column). Shots in docs/design/audit/CARRIER-0-G/.
- CARRIER-0-G review-1 FIX: focus/hover ring is now a 3.5-wide token overlay path drawn above all cells; key handler extracted and tested; cells only focusable with onSelect. Screenshots docs/design/audit/CARRIER-0-G/r2-stats-390-{en,ar}-{dark,light}-focus.png (ring clearly visible). Left: roving tabindex (optional), AR wilaya names (no name_ar column, follow-up row), bidi isolation in title string.

## CARRIER-0-G done (ship)
- Done: map keyboard access on /app/statistics (cells focusable only with onSelect, key handler extracted and tested, token focus ring overlay); sticky filter panel no longer covers the map on phones (review-2 #5, #6).
- Verify: scripts/gate.sh GATE OK (tsc, 941 passed 5 skipped incl. live RLS suite, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/CARRIER-0-G.review-2.md VERDICT: PASS; screenshots in docs/design/audit/CARRIER-0-G/.
- Owner: none. Not shot: table scroll fade in AR.
- Next: wilaya Arabic names need a migration (no name_ar column); roving tabindex optional.

## SEC-1-G build notes
- Done: 00071 (`audit_redact`/`audit_is_secret_key`: masked-string and empty/masked-secret passthrough before the depth cap, separator `[^a-zA-Z0-9]`, plurals, one-pass backfill); TS twin same (`u` flag); parity cases + idempotence + `TS(SQL(x))==SQL(x)` + 42501 execute-denied + psql backfill/xmin test; `diffRows` by path segments (`id`, empty key, arrays, any mask token = pill); audit table (pill `role=note` + aria-label `audit.redactedAria`, `emptyKey`, `<li dir=ltr>`, break-all key), `loading.tsx`, `error.tsx` (page now throws on read error), empty-state clear-filters action; DB.md + D49 amendment note (owner ack pending, not blocking).
- Screenshots (chrome-devtools, `docs/design/audit/SEC-1-G/{en,ar}-{dark,light}-{1440,390}.png` + `en-dark-390-focused-pill.png`, `en-dark-390-empty.png`): all 8 combos shot with a seeded row (pill, empty key, masked array, colliding `a.b`, long key wraps at 390, short `is_active` line). Pill contrast 7.0:1 light, 6.4:1 dark. Theme/locale switched by setting the `theme`/`NEXT_LOCALE` cookies then reloading. Loading skeleton shown briefly in dev only (not shot).
- Step 6: no leftover `zrexpress` row after `db reset` (nothing to delete).
- Gate note: first gate run failed `src/lib/rls.test.ts` (agents are financially blind: "sign in admin@seed.mnw: Invalid login credentials"); not touched by this branch, caused by `db reset` wiping seed users; reseeded, then green.

### SEC-1-G fix round 2
- M1: audit screenshots retaken at 390 px after review-1 fixes (chrome-devtools emulate 390x1100): `en-dark`, `en-light`, `ar-light`, `ar-dark` (seeded row: pill, empty key, masked array, colliding `a.b`, long key, short line), `en-dark-390-focused-pill`, `{en,ar}-dark-390-empty` (filtered), `en-dark-390-loading`. No horizontal scroll (scrollWidth 390). Found and fixed: AR date aligned left (bdi block); now inline bdi in a div. Pill contrast light 7.0:1. Filtered empty state shows two "Clear all" (bar and empty action), kept per L3. Not shot: unfiltered empty, error state (needs a failing query), 1440 px (old images kept).
- L1-L7 done: DB.md line, zod URL filters, empty action/hint, error reason, test seed `api/key`+`secretkeys`, `migration up` applied 00072 locally, mobile date stack, `zr_shipments` filter.

## SEC-1-G ship
- Done: merged to v3 under D40/D85 on a review-3 ESCALATE (no PASS). Migrations 00071 + 00072 (audit redaction, DB and TS side). SEC-1-H follow-up row added.
- Verify: `scripts/gate.sh` full on v3-SEC-1-G = GATE OK (tsc, 987 tests incl. live RLS, i18n, color lint, build, protected paths).
- Evidence: focused-pill PNG is not a focus shot; 1440 px images predate " › " labels; pill contrast 7.0:1 light / 6.4:1 dark is builder's figure.
- Owner: remote `db push` of 00071 and 00072 (O-2); D49 amendment ack pending; Q-21 open.
- Next: SEC-1-H (todo).

## SEC-1-H build notes
- Done: backfill test sets `lock_timeout='5s'` and skips without the DB container; 1-arg `audit_redact` 42501 test (agent, anon); parity cases for trailing-newline token and uppercase-hex; diff `label()` (`[0]` indices, `.`/` › ` keys JSON-quoted); `_lib/params.ts` (`parseAuditParams`, real-date check, `AUDITED_TABLES` = 21 tables from the DB, fixed +01:00 day bounds with `lt` next-day) + tests incl. live trigger-list check; `Column.className`; pill focus ring; rtl `<bdi>` on the AR empty-key label; render tests (empty, filtered Clear href, rtl bdi, ring, colliding labels, loading, error retry).
- Contrast `text-muted-foreground` on `bg-secondary` (computed, canvas-resolved): light 7.02:1, dark 6.37:1.
- Screenshots `docs/design/audit/SEC-1-H/{en,ar}-{dark,light}-{1440,390}.png` (viewport shots at the seeded top row) + `en-{dark,light}-390-focused-pill.png` (differ from unfocused, `cmp`). Earlier SEC-1-G "ar" shots may have been English (cookie is `locale`, not `NEXT_LOCALE`). No horizontal scroll at 390. Timezone +01:00 assumed (no workspace tz setting found).

## SEC-1-H ship
- Done: audit follow-ups (backfill lock_timeout + skip without DB, 1-arg `audit_redact` 42501 test, parity cases, diff `label()` quoting, `_lib/params.ts` with 21 audited tables and +01:00 day bounds, `Column.className`, pill focus ring, rtl bdi, render tests). Plan row SEC-1-H = done.
- Verify: `scripts/gate.sh` GATE OK on v3-SEC-1-H (tsc, 1004 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/SEC-1-H.review-1.md VERDICT: PASS; shots docs/design/audit/SEC-1-H/ (en/ar, dark/light, 1440/390, focused pill).
- Owner: remote `db push` (none new in H); Q-21 open; D49 amendment ack pending.
- Next: none from H; SEC-1-G carry-overs per its entry.

## NAV-1-G build
- Done: drawer dialog name `nav.menu`, aside tabIndex only while drawer open, `dir="ltr"` on three kbd hints, substring palette filter (`src/lib/palette-filter.ts`, Arabic-normalised) wired via `CommandDialog filter`, NAV-1-F brief example fixed. Tests in `src/lib/palette-filter.test.ts`.
- Screenshots: not taken in this build session (no browser run); left for /verify ui-reviewer.

## NAV-1-G ship
- Done: NAV-1-G drawer dialog name, aside tabIndex only while drawer open, ltr kbd hints, substring palette filter (`src/lib/palette-filter.ts`), tests.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-1-G (tsc, 1010 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-1-G.review-1.md VERDICT: PASS. No new screenshots in this ship step.
- Owner: none.
- Next: none from G.

## NAV-2 (build)
Breadcrumb in top bar (shared, `CrumbRecord` for record names), required `PageHeader.subtitle` + `related`, hubs /app/sell|catalog|money|team via `GroupHub`, store Crumbs removed. Screenshots (browser MCP, dark, AR, 390px): /app/money hub, /app/orders/new breadcrumb overflow. Not captured: light theme, EN, 1280, agent hub, product/order record tails.

## NAV-2 ship
- Done: NAV-2 breadcrumb in top bar, required `PageHeader.subtitle` + `related`, group hubs /app/sell|catalog|money|team via `GroupHub`, store Crumbs removed.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-2 (tsc, 1016 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-2.review-3.md VERDICT: PASS. Screenshots from build: /app/money hub, /app/orders/new breadcrumb overflow.
- Owner: light theme, EN, 1280px, agent hub, product/order record tails not captured.
- Next: NAV-3.

## NAV-3 — canonical URLs (v3-NAV-3)
Moved orders/contacts/products/stock/pricing/finance routes under sell|catalog|money; 308 table in `src/lib/legacy-redirects.ts` (+ test); courier cash now one page with `?tab=collections|income`. Browser check: old income/cash/products URLs land correctly (AR dark, 1280); screenshots in docs/design/audit/NAV-3 (not full light/EN/390 matrix).

## NAV-3 ship
- Done: canonical /app URLs (sell|catalog|money), 308 legacy redirects (`src/lib/legacy-redirects.ts`), one Courier cash page `?tab=collections|income`. Plan row NAV-3 = done.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-3 (tsc, 1021 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-3.review-2.md VERDICT: PASS; shots docs/design/audit/NAV-3.
- Owner: light theme, EN, 390px matrix for NAV-3 not captured.
- Next: NAV-5 (MONEY-2, RES-1, P1-5 also unblocked by NAV-3).

## NAV-4 (build)
Migration 00073: `options.emoji` (admin-only, DB-checked; ZWJ allowed) and `status_label_overrides` (RLS, audited). Chip emoji + option consumers, `EmojiField` picker, `StatusLabelsProvider` + pure `resolveStatusLabel` (no ICU, i18n/request.ts untouched), pill/select/delivery advance/confirmation/filter bar/customers wired, Settings "Options & labels" block. Follow-up NAV-4-V (saved-view emoji) added to plan. Screenshots (browser MCP, docs/design/audit/NAV-4): settings AR dark 1280, emoji picker AR light 390. Not captured: EN, other themes/sizes of orders list, kanban, customers, agent session, /login.

## NAV-4 (fix round 1)
`StatusPill` is now a client component (it called a client-only hook from server components, which crashed product and stock pages). `emojiSchema`/`startsWithEmoji` accept flags and keycaps (DB CHECK already allowed them). Browser MCP sweep as admin and as confirmation agent: orders, order detail, product (+stock), stock, customers, kanban, settings, store: no error page, no console error. Screenshots in docs/design/audit/NAV-4: EN+AR, dark+light for orders/product/settings, order detail, stock, customers, kanban (1280 and one 390), agent orders, /login. Not done: review LOW findings 4-11, not in this round's scope.

## NAV-4 (fix round 2)
StatusPill renders the default label as sr-only text for an emoji-only override (`isEmojiOnly` in `src/lib/emoji.ts`, tested); the store status select uses overrides; tests for flags/keycaps. Screenshots in docs/design/audit/NAV-4-R2 (each looked at): saved overrides (flag, emoji-only, 40-char truncated in compact pill, AR text), orders (EN dark 1280, AR light 1280), confirmation (EN dark 1280, EN dark 390, AR light 390), real shipping kanban (EN dark 1280, AR light 390), labels block `?section=options` (EN dark 1280, AR light 1280, EN light 390, AR dark 390), agent session (EN dark 1280, AR light 390), /login 390 (EN light, AR dark). The 40-char label was set via SQL for that shot, overrides reset afterwards. Misleading old shots removed. Not done: LOW findings 4-11, action-layer agent-rejection tests.

## NAV-4 ship
- Done: emoji on option labels, label overrides for system statuses (migration 00073), Settings "Options & labels". Plan row NAV-4 = done; follow-ups NAV-4-F (review-3 LOWs + missing tests, ui, M) and NAV-4-S (anon grants on public.options, H / sec / M) added.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-4 (tsc, 1045 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-4.review-3.md VERDICT: PASS; shots docs/design/audit/NAV-4, NAV-4-R2, NAV-4-R3.
- Owner: light theme and EN matrix for kanban, customers, agent session not fully captured (see NAV-4-F).
- Next: NAV-4-S (H, sec) and NAV-4-F; NAV-5 next in lane order.

## Run report (2026-11-20, /auto 5, second batch)
- Shipped 5: SEC-1-H `28731eb`, NAV-1-G `ad42dc6`, NAV-2 `abd2c39` (3 review rounds), NAV-3 `ebea6f9` (2 rounds), NAV-4 `e3d04b7` (migration 00073, brief review + 3 rounds).
- Parked: none. Decided by Claude: none (no new D-row, no new question).
- Caught in review before merge: NAV-2 order/product detail pages looped on render; NAV-4 brief would have leaked one workspace's status labels to others and could break `/login` (redesigned before build), then `StatusPill` crashed product and stock pages.
- Open questions unchanged: Q-28 CHART-1, Q-26 VAR-1, Q-18 CONF-1; STORE-3 also waits for the owner's merge OK.
- Owner before a remote `db push`: 00073 is new (`options.emoji`, `status_label_overrides`).
- Gate: intermittent live-DB failures again (`seasons.rls.test.ts`, `rls.test.ts`), green on rerun (TEST-2). NAV-3's merge gate first failed on tsc from the dev server's stale `.next/dev/types`; clean on rerun, then pushed. The review step returned once before its reviewers finished; the coordinator assembled `NAV-4.review-2.md` from their reports.
- Follow-ups added: NAV-4-F, NAV-4-S (anon grants on `public.options`, pre-existing, RLS blocks it; H / sec), NAV-4-V (waits on CONF-1), SEC-1-I, NAV-1-H, NAV-2-F, NAV-3-F.
- Next `/auto`: NAV-4-F, NAV-4-S, NAV-5, then SEC-1-I, NAV-1-H, NAV-2-F, NAV-3-F, P1-1-F.

## NAV-4-S: done
- Done: migration 00074 revokes anon grants on `public.options` / `option_sets`; live test; DB.md updated; follow-up NAV-4-S2 added (sweep ~36 anon grants).
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-4-S (tsc, 1049 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-4-S.review-1.md VERDICT: PASS.
- Owner: remote `db push` of 00074 (revokes anon grants; owner-only).
- Next: merge to v3; NAV-4-S2 (owner/decide call) and NAV-5 in lane order.

## NAV-4-S2: done
- Done: migration 00075 revokes the remaining anon table grants in `public` (sweep plus default privileges); live anon-grants test; DB.md rule. Follow-up NAV-4-S3 (sweep anon function EXECUTE, 26 public functions) per brief.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-4-S2 (tsc, 1058 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan). Coordinator rerun also GATE OK.
- Evidence: docs/briefs/NAV-4-S2.review-1.md VERDICT: PASS (review-0 was FIX, resolved).
- Owner: remote `db push` of 00075 (owner-only; revokes anon grants).
- Gate note (TEST-2): one intermittent failure in `audit-redact.rls.test.ts` on this branch; green on the coordinator's full rerun. Same flaky class as before.
- Next: NAV-4-S3 (anon function EXECUTE sweep); NAV-5 in lane order.

## NAV-4-S3: done
- Done: migration 00076 revokes anon/PUBLIC EXECUTE on public functions and the default function privilege for anon; live test; DB.md rule.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-4-S3 (tsc, 1065 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-4-S3.review-1.md VERDICT: PASS (review-0 was FIX, resolved).
- Owner: remote `db push` of 00076 (owner-only; revokes anon function EXECUTE).
- Next: NAV-5 in lane order.

## NAV-5: built (awaiting /verify)
- Done: agent `/app/my-day` (read-only, session client, D86 counts, no migration), `roleHome` landing for login/orders/not-found, `MY_DAY` + `bottomBar()` in nav-model, phone bottom bar (More = drawer, header hamburger removed).
- Not done: screenshots (no running app/login session in this run); owner/ui-reviewer must screenshot 390 px light/dark EN/AR.

## NAV-5: done
- Done: phone bottom bar + agent "My day" home merged under D40/D87; review-3 ESCALATE resolved by D87 (commit 2a74a31 removes viewport-fit cover and top/side insets); no 4th review round.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-5 (tsc, 1081 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-5.review-1.md FIX, .review-2.md FIX, .review-3.md ESCALATE (answered by D87, option b).
- Owner: screenshots at 390 px (light/dark, EN/AR) and real-phone check owed (NAV-5-G); review-1 low #9 reopened (NAV-5-F).
- Next: NAV-5-F, NAV-5-G.

## NAV-5-F: built (awaiting /verify)
- Done: delivery count uses the last delivery-stage row per order (shared `lastPerOrder`, query no longer filters `to_status`); live fixtures (second courier, admin change adds one to call again, profile-setup error asserted); queue title "Team queue: orders to deliver" and dashboard card "Waiting for first call" (EN/AR, counts unchanged); tests for my-day layout guard, root redirect, bottom bar (sub-route, 99+, md:hidden, More ref), loading and error states.
- Limits: no DOM test environment, so "focus returns to More" pins the ref wiring only, not the focus call itself.
- (d) 768 px dashboard overflow: filter card now `lg:w-fit` with minmax grid columns (review 1 FIX); not re-measured live. Docs excluded from Tailwind scan.
- (e) Not built: `viewportFit: "cover"` and top/side insets stay out (D87); no notched iPhone simulator confirmed (only `xcrun simctl` "iPhone Duo"); safe-area class test not written.
- Screenshots (390 px, light/dark, EN/AR): not taken, no browser MCP run in this session.

## NAV-5-F: done
- Done: review-1 FIX items landed (delivery count per last delivery-stage row, live fixtures, queue/dashboard copy EN/AR, my-day layout, root redirect, bottom bar and loading/error tests); review-2 PASS (ui-reviewer, fc04611).
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-5-F (tsc, 1094 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-5-F.review-1.md FIX, docs/briefs/NAV-5-F.review-2.md PASS.
- Owner: screenshots at 390 px (light/dark, EN/AR) not taken in this run; owed via NAV-5-G; 768 px overflow not re-measured live.
- Next: NAV-5-G.

## NAV-5-G — NAV-5 screenshots at 390 px (2026-11-20) — screenshots done, awaiting review (not DONE until review passes)
- Done: chrome-devtools emulation, local stack, seed users. Shots in `docs/design/audit/NAV-5/g-*`: admin dashboard + orders + More drawer, confirmation agent My day + More, delivery agent My day; each 390 px, EN+AR, light+dark. 1280 px admin and delivery: bottom bar `display:none`. 768 px AR and 844x390 landscape AR: bar hidden (md breakpoint = 768), sidebar shown, page scrollWidth == viewport (only the orders table scrolls inside its own wrapper), so no page overflow.
- Review-1 fixes: `g-admin-orders-ar-dark-390.png` re-shot (header, filters, table, bar visible). Empty My day (confirmation agent, tasks empty + no planned meeting) shot EN/AR x light/dark: `g-conf-myday-empty-*-390.png`; produced locally by setting the one planned seed meeting to `cancelled` for the shoot, then restored to `planned`. `g-conf-badge99-{ar,en}-dark-390.png` are DOM text overrides ("18" -> "99+", real count was 18, no 100 orders seeded); badge box 197-223 px sits inside its link 130-260 px. The "99+" cap logic itself is covered by the unit test, not by data. Scrolled-to-end shot `g-conf-myday-scrolled-end-en-dark-390.png`: last card ends above the bar (other roles: numeric check only, 764 < 792). The Next dev "N" overlay was hidden by CSS in the re-shot files only; older g-* shots still show it (dev-only).
- Measured: header 56 px; bar items 51 px high, 78 px wide (admin); last content bottom 764 px < bar top 792 px; AR bar order mirrored; viewport meta is `width=device-width, initial-scale=1` (no viewport-fit); no hardcoded-color look in either theme. Defects: none, clean. No code changed.
- Gate: scripts/gate.sh GATE OK (first run failed once on a seasons.rls.test FK race, passed on rerun; no code changed).
- Not covered: populated confirmation tasks (no seed tasks). Thin coverage at 1280/768/844x390 (one AR dark shot each).
- Real iPhone/Android check NOT done (no device) and stays owner-owed, incl. keyboard-open bar. Review-1 low #9 (iOS bottom padding 0 without `cover`) stays open per D87.
- Flag: D87 item 7 (no-role/inactive redirect loop, risk H) has no plan row; owner/decide to confirm.

## NAV-5-G: done
- Done: 390 px screenshots (light/dark, EN/AR) in `docs/design/audit/NAV-5/g-*`; review-1 FIX landed (re-shot AR dark orders, empty My day, 99+ shot, scrolled-end shot); review-2 PASS (ui-reviewer). No code changed.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-5-G (tsc, 1094 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan). One earlier run hit the reviews.rls.test.ts:74 FK teardown race; green on rerun.
- Evidence: docs/briefs/NAV-5-G.review-1.md FIX, docs/briefs/NAV-5-G.review-2.md PASS.
- Owner: real iPhone/Android check and keyboard-open bar (no device); review-1 low #9 (iOS bottom padding without viewport-fit=cover) open per D87; D87 item 7 (no-role/inactive redirect loop) has no plan row.
- Next: none for NAV-5-G; owner decides on D87 item 7 row.

## NAV-5-H review-1 fixes — screenshot self-critique
Shots in `docs/design/audit/NAV-5-H/` (chrome-devtools MCP, null-profile local user): `/no-access` EN+AR x dark+light at 390 and 1280, plus the sign-out error state (AR, light, 390). Light muted text is about 8:1 on the card. RTL: exit icon mirrors, locale switcher sits top-end, error alert is centered, retry/sign-out are 44 px high. Signed-out visit lands on `/login`. Not done: keyboard pass and the sign-out pending state were not captured (pending is too brief to screenshot). Live RLS test for users a/b/c added in `src/lib/rls.test.ts` and passing against the local stack.

## NAV-5-H: done
- Done: `/no-access` page for a signed-in user with no role, inactive profile or no workspace, with sign-out; review-1 fixes (live RLS test for users a/b/c, sign-out button, test strength); review-2 PASS (VERDICT in docs/briefs/NAV-5-H.review-2.md).
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-5-H (tsc, 1129 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: docs/briefs/NAV-5-H.review-1.md FIX, docs/briefs/NAV-5-H.review-2.md PASS; screenshots in docs/design/audit/NAV-5-H/.
- Owner: review-2 lows go to NAV-5-I (vacuous RLS check at src/lib/rls.test.ts:554, missing keyboard pass, untested errorAs="toast", cycle-test gaps).
- Next: NAV-5-I.

## NAV-5-I — close NAV-5-H review-2 lows (2026-11-20)
- Done: RLS no-access check now uses `select("*", {count:"exact", head:true})` and asserts `error` null then count 0 (fail-proof: selecting `nonexistent` made all 3 cases fail; reverted). Tests added: sign-out toast/inline, unknown role on /no-access, cycle `[...rest]` and `/login` (2 hops; dead reassigned-handler case replaced), sell real `getProfile` -> `requireProfile` path. rbac query-error test already existed.
- Browser (chrome-devtools, local stack): keyboard pass on `/no-access` EN and AR (rtl): Tab order language switcher, Retry, Sign out; box-shadow focus ring visible on each; Enter on the switcher switched language, Space on Sign out signed out. Shot: `docs/design/audit/NAV-5-H/no-access-en-focus-signout.png` (dark only; light not re-shot). Role home: a signed-in profile visiting `/login` landed on `/app/dashboard`. Sign-out landed on `/login`. Local user `noaccess-shots@seed.mnw` deleted. Page closed back to about:blank.
- Not done: My day / Team rules blank for a deactivated user (optional finding 5, out of scope).

## NAV-5-I: done
- Done: review-1 PASS (docs/briefs/NAV-5-I.review-1.md). Closed NAV-5-H review-2 lows: non-vacuous no-access RLS check, sign-out toast/inline tests, unknown-role and cycle tests, sell real-path test, /no-access EN+AR keyboard pass.
- Verify: `scripts/gate.sh` GATE OK on v3-NAV-5-I after one re-run (tsc, 1136 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: first run failed only on live-DB FK race (audit_log_workspace_id_fkey) in delivery-prices.rls and reviews.rls tests; known intermittent (TEST-2), passed on re-run.
- Owner: light-theme shots exist in docs/design/audit/NAV-5-I/ (en-light-*); optional finding 5 (deactivated user My day / Team rules blank) out of scope.
- Next: none for NAV-5-I; merge to v3 pending.

## SEC-1-I build notes
- Closed SEC-1-H review-1: ar empty-key test reads the `dir` attribute off the parsed `<bdi>` tag; error-state test finds the retry button by `type="button"`; new `page.test.tsx` (from -> `gte T00:00:00+01:00`, to -> `lt` next day), single-render test for the changes list per breakpoint class; shared `src/lib/test-db.ts` (`DB_CONTAINER`, `dbContainerUp`) used by both live-DB tests; audit table filter + chip show `audit.tables.*` labels (en+ar, sorted by label, raw-name fallback, parity test `_lib/tables-i18n.test.ts` over all 22 AUDITED_TABLES; brief said 21).
- Timezone: no workspace tz setting exists; `AUDIT_TZ = "+01:00"` kept, commented and noted in docs/DB.md.
- SEC-1-G `ar-*` shots deleted (5 files existed, not 6). SEC-1-H ar shots checked: real Arabic, rtl (pill reads "مخفي").
- Screenshots `docs/design/audit/SEC-1-I/` (chrome-devtools, cookies `theme`/`locale`; a temporary local audit_log row with a redacted api_key was inserted for the seed workspace and deleted afterwards). `html` lang/dir verified ar/rtl. Focused vs unfocused pill (EN light and dark): `cmp` reports they differ; `:focus-visible` true. Pill contrast measured from computed styles: light 7.02, dark 6.37. Filter open: EN dark (1440) and AR light (1440) show labelled, sorted tables.
- Caveat: the MCP window cannot go below 500 px wide, so "390" shots are 500 px viewports (no horizontal scroll, scrollWidth 500).
- Page closed back to about:blank.

## SEC-1-I: done
- Done: review-1 PASS (docs/briefs/SEC-1-I.review-1.md). Closed SEC-1-H review-1 lows and missing tests; audit table filter labelled (en+ar); timezone note in docs/DB.md; stale SEC-1-G ar shots removed. Lows 1-4 carried to SEC-1-J.
- Verify: `scripts/gate.sh` GATE OK on v3-SEC-1-I (tsc, 1140 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: screenshots in docs/design/audit/SEC-1-I/; pill contrast light 7.02, dark 6.37 (computed styles).
- Owner: `+01:00` audit timezone is an assumption (no workspace tz setting); the review did not re-measure contrast.
- Next: SEC-1-J (review-1 lows 1-4).

## Run report — /auto 5 (2026-11-20, batch after NAV-5)
- Shipped 5: NAV-5-F (fc5e98f, was built + review PASS, only the merge was missing) · NAV-5-G (eaf3ef5) · NAV-5-H (f65c3b7) · NAV-5-I (2238319) · SEC-1-I (3cdb00e).
- Decided by Claude: D88 — the no-role / inactive-profile redirect loop named in D87 (7) got its own row NAV-5-H (risk H, sec); NAV-5-G stayed the screenshots task. NAV-5-H is built: such a user now lands on `/no-access` with Try again + Sign out.
- New follow-up rows: NAV-5-I (done), SEC-1-J (todo).
- Questions still open: Q-18 (CONF-1), Q-26 (VAR-1), Q-28 (CHART-1); STORE-3 also waits for the owner's OK. No new question.
- Blocked, unchanged: CONF-1, VAR-1, CHART-1, STORE-3 (owner OK), NAV-4-F (review rounds exhausted). Nothing parked in this run.
- TEST-2 (intermittent live-DB tests) hit every task of this run: 9 gate runs failed and passed on re-run with no code change (seasons.rls, reviews.rls, delivery-prices.rls, kpi, variants.rls: FK races and 5 s timeouts). One cause found: pages left open in the chrome-devtools browser held a renderer at 100% CPU (load 10); closing them made the NAV-5-H merge gate pass. It still failed afterwards on a quiet machine, so the FK race is separate. Worth running TEST-2 before more tasks.
- Owner-owed, unchanged: bottom bar and My day on a real iPhone/Android (NAV-5-G shots are emulated; "390 px" shots of SEC-1-I are 500 px, the tool's minimum).
- Next `/auto` picks: SEC-1-J, NAV-1-H, NAV-2-F, NAV-3-F, then P1-1-F.

## SEC-1-J: screenshots
- Screenshots `docs/design/audit/SEC-1-J/` (chrome-devtools, cookies `theme`/`locale`): EN dark and AR light at 1440 and 500 px. Rows show the translated table name (ZR shipments / شحنات ZR, Settings / الإعدادات), mobile cards show it once, AR html is rtl, no horizontal scroll. Nothing to fix. Not shot: EN light and AR dark (same tokens).
- Caveat: the MCP window cannot go below 500 px, so "390" shots are 500 px. Page closed back to about:blank.

## SEC-1-J: done
- Done: closed SEC-1-I review-1 lows 1-4 (DB.md punctuation, shared audit table label helper with raw-name fallback, structural breakpoint test, live RLS guard via dbContainerUp).
- Verify: `scripts/gate.sh` GATE OK on v3-SEC-1-J (tsc, 1143 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: review-1 PASS (docs/briefs/SEC-1-J.review-1.md); screenshots in docs/design/audit/SEC-1-J/.
- Owner: nothing new; EN light and AR dark not shot (same tokens).
- Next: none for SEC-1-J; merge to v3 pending.

## Antigravity handover prepared (2026-11-20) — DONE (branch v3)
- Done: `docs/ANTIGRAVITY.md` rewritten (install, sign-in, models, permissions, night run, parallel agents); `scripts/agy-setup.sh`, `scripts/agy-night.sh`, `scripts/agy-parallel.sh`; `.agents/` rules and `loop-auto` skill updated to the current loop (one task per session, `nodb`, `as:<name>`, RUN-END line); `dev-up.sh` takes `APP_PORT`; gate honours `GATE_SKIP_LIVE=1` for no-database workers; `night-run.sh` runs a list of task ids and stashes leftovers instead of committing them (D91).
- Not verified: `agy` is not installed here, so none of the Antigravity scripts has run. Model names from the docs: Orchestrator (Argon), Gemini 4 Argon, Gemini 4 Hydrogen.
- Next: merge the four finished features (STORE-3, CONF-1, VAR-1, CHART-1), then STORE-4.

## TEST-2 — flaky live-DB suites
Root cause (repro: 4x `npx vitest run` + per-file workspace-count diff, logs in $TMPDIR/t2): (1) the seasons backfill test ran the raw 00061 insert for EVERY workspace, racing other files' teardown (audit_log FK 23503); (2) `deleteWorkspaces` emptied only 3 audited tables, so cascades fired `audit_row()` after the workspace row was gone; (3) `store/data.test.ts` ignored the delete error and leaked one workspace per run (audit rows blocked by product_variant_values -> product_option_values FK).
Fixes: backfill scoped to its own workspace; `AUDITED_WORKSPACE_TABLES` (+ variant tables) in `src/lib/test-cleanup.ts`, checked against pg_trigger by `test-cleanup.test.ts`; data.test.ts asserts the delete. No timeouts seen, so no per-file timeouts added (step 4 skipped: no evidence). Ad-hoc teardown in other suites left as is (redundant, harmless).
Result: full gate green 5x in a row with dev server up; workspaces=16, orders=60 constant across runs.

## TEST-2 — DONE (branch v3-TEST-2)
- Done: root cause fixed (seasons backfill scoped to own workspace; shared audited-table teardown in `test-cleanup.ts` incl. variant tables; `store/data.test.ts` asserts delete). See the TEST-2 entry above for evidence.
- Verify: `scripts/gate.sh` GATE OK on v3-TEST-2 at merge time (tsc, 1145 passed 5 skipped incl. live RLS, i18n parity, color lint, build, protected paths, secret scan).
- Evidence: no review file (brief risk low, surface none). The 5x consecutive green run is not re-measured in this pass.
- Owner: none.
- Next: merge to v3 (ship step).

### Run report (auto TEST-2)
- Shipped: TEST-2 (merge b45aa09). Causes: seasons backfill ran on all workspaces, `deleteWorkspaces` emptied 3 of 22 audited tables, data.test leaked a workspace per run.
- Decisions by Claude: none. Questions open: Q-28, Q-29 (unchanged). Blocked: none.
### STORE-3 round 5 (D61 follow-up, last allowed round)
Round 5 ran because the D40 merge without a PASS verdict is refused by the ship step. Merged origin/v3 (P1-7), db reset, types regenerated. Fixed review-4 mediums: pricing payload is now a pure `buildPricingPayload` (unit test + live test: per_value then uniform leaves every `price_delta` 0); the public page shows a sold-out state (Arabic, no offers, no order slot) when every size is out, with a test. Low 3 fixed (offer-price header). Screenshot: `docs/design/audit/STORE-3/r5-store-light-390-soldout.png` (390 light, checked by eye). Rest stays in `docs/briefs/STORE-3.followups.md`.

## STORE-3 — shipped (merge D89)
Merged v3 into v3-STORE-3, migration 00051 renumbered 00077, `selling/` moved under `catalog/products/[id]`, product_offers/product_forms added to the audit lists + labels. Gate OK (1193 pass). Open mediums → STORE-3-F; lows → BACKLOG.
