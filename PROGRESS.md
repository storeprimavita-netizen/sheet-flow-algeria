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
