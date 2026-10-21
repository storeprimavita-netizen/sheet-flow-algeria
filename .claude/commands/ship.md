---
description: Loop step 4 (haiku, forked) — gate, PROGRESS block, commit, merge into mnw; push only past owner gates
model: haiku
effort: low
context: fork
---
For branch `mnw-<id>` ($ARGUMENTS = id): confirm docs/briefs/<id>.md has `risk: low` OR a recorded /verify pass (ask the caller if neither — do not guess). Run `scripts/gate.sh`; if it fails, STOP and return the 6-line failure. Never print secret values.
Then: append ≤ 8 lines to PROGRESS.md (Done / Verify / Evidence / Next — facts only, no essays) and tick the task in docs/MASTER_PLAN.md; commit (end message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`); `git checkout mnw && git merge --no-ff mnw-<id>`. Push to GitHub ONLY if PROGRESS.md lists P0-6/P0-7 gates as cleared by the owner; otherwise report "merged locally, push gated". Return ≤ 60 words: merge commit, gate result, push status.
