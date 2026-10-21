---
description: Loop step 1 (sonnet, forked) — pick next MASTER_PLAN task, trace it, write docs/briefs/<id>.md
model: sonnet
effort: medium
context: fork
---
Pick the first not-done task in docs/MASTER_PLAN.md whose dependencies are met (or the id in $ARGUMENTS). If it needs an owner action/credential, stop and say which.
Orient with `graphify query` first (not broad greps), then read the REAL code/migrations/policies the task touches — the plan may have drifted. Read docs sections the task cites; never docs/PROGRESS_ARCHIVE.md. No feature code, no branch.
Write docs/briefs/<id>.md (≤ 60 lines): `risk: high|low` (high = RLS/auth/migration/money/webhook/ZR/public form), exact files + change per file, migration skeleton if any, step order, acceptance tests (named), edge cases found, confirmed/stale assumptions.
Return ONLY: task id, risk tag, brief path, ≤ 5 bullets of what matters. Under 120 words.
