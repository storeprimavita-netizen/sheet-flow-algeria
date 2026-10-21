---
description: Loop step 2 (opus, forked) — independent adversarial review of the brief or the diff; mandatory when risk=high
model: opus
effort: high
context: fork
agent: qa-reviewer
---
Review $ARGUMENTS (a brief path before implementation, or `git diff mnw` / a migration path after). Intended behavior is in docs/briefs/<id>.md and docs/DECISIONS.md — read those, not any summary of mine. Attack it per your instructions. Return ranked findings (file:line, exploit/failure, fix) and missing tests, under 400 words. Do not edit files.
