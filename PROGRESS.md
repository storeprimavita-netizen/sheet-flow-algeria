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
| 0 — DB rebaseline + auth foundation | docs/phases/phase-00.md | pending |
| 1 — Shell, six-section IA, guards, Slack removal | docs/phases/phase-01.md | pending |
| 2 — Settings section | docs/phases/phase-02.md | pending |
| 3 — Products (details/expenses/ad-spend/stock) | docs/phases/phase-03.md | pending |
| 4 — Pricing engine + Real + tests | docs/phases/phase-04.md | pending |
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
- MCP note: `graphify`/`poneytail` tools are NOT available (docs/TOOLING.md).
