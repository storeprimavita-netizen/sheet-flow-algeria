---
description: Phase-14 loop step 1 — orient on the project (graphify + short docs only), no code, no branch
---

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
