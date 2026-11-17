---
description: Loop stage 1 (sonnet, forked) — claim the next MASTER_PLAN task, trace it, write docs/briefs/<id>.md
model: sonnet
effort: medium
context: fork
---
Task: the id in $ARGUMENTS, else the first `todo` task in docs/MASTER_PLAN.md whose deps are all `done`. If it needs an owner input that the plan lists as open, stop and say which.

Claim it: on `v3` (`git checkout v3 && git pull --rebase`), set its status to `claimed:claude`, then `scripts/step.sh "<id>: claim"`. If the push is rejected, pull, and if the task is now claimed by someone else pick the next one.

Read the spec the task names (`docs/specs/<EPIC>.md`) and the DECISIONS rows it cites. Then read the REAL code, migrations and policies the task touches — the plan may have drifted (orient with `graphify query` if installed, else targeted Grep). Never read docs/PROGRESS_ARCHIVE.md. No feature code.

Write docs/briefs/<id>.md (≤ 60 lines):
- header: `risk: high|low` · `surface: ui|security|ui,security|none` · `lane: <from plan>` (risk high = RLS/auth/migration/money/webhook/carrier/public form/tracking tokens/MCP)
- goal in one sentence and the definition of done as checkable statements
- exact files + the change per file; migration skeleton if any (checklist from AGENTS.md)
- step order, each step small enough to commit and push on its own
- acceptance tests by name; for UI, the screens to screenshot
- edge cases found, assumptions confirmed or stale, anything that needs a new DECISIONS row (then stop: that is the owner's call)

Commit with `scripts/step.sh "<id>: brief"`. Return ONLY: task id, risk, surface, brief path, ≤ 5 bullets of what matters. Under 120 words.
