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

## CONF-1 built (branch v3-CONF-1, pending /verify)
- Done: `order_views` (00056, RLS, seeds new/no_answer/duplicates), `src/lib/order-views.ts`, shared `orders/_lib/order-query.ts`, views strip + modified bar + dialogs on all / confirmation / delivery. Types generated with `--local`. Owner note: 00056 applies before the parked 00051 on a remote push.
- Not done: screenshots (step 9) were not taken; no browser run in this session. Page-level tests (delivery stays confirmed-only, agent opening an admin view) and UI keyboard tests are not written.
- Gate: GATE OK.
