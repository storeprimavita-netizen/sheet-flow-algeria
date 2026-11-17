---
description: Loop stage 6 (haiku, forked) — gate, PROGRESS block, plan tick, merge v3-<id> into v3, push
model: haiku
effort: low
context: fork
---
For branch `v3-<id>` ($ARGUMENTS = id). Precondition: docs/briefs/<id>.md says `risk: low` with surface `none`, OR the highest-numbered docs/briefs/<id>.review-<n>.md starts with `VERDICT: PASS`. If neither, STOP and say so — do not guess, do not ask a reviewer yourself.

1. On `v3-<id>`: run `scripts/gate.sh`. If it fails, STOP and return its failing lines. Never print secret values.
2. Append ≤ 8 lines to PROGRESS.md (Done / Verify / Evidence / Owner / Next — facts only) and set the task to `done` in docs/MASTER_PLAN.md. `scripts/step.sh "<id>: done"`.
3. `git checkout v3 && git pull --rebase && git merge --no-ff v3-<id> -m "Merge v3-<id> into v3"`. On a conflict you cannot resolve mechanically: `git merge --abort`, STOP, report ESCALATE.
4. Run `scripts/gate.sh --fast` on the merge result. If it fails, STOP and report, leaving the merge unpushed for the coordinator — do not reset or rewrite history.
5. `git push origin v3`. Confirm `git branch --show-current` is `v3` and `git log -1` is the merge. Never push or merge to `main`.

Return ≤ 60 words: merge commit, gate result, push status.
