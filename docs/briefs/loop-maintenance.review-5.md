VERDICT: PASS

## Summary
Reviewed `git diff --cached` (scripts, stage-models.conf, docs). No high or medium finding.
stage.sh `entries()` is bash 3.2 safe (here-strings, every grep guarded by `|| true`); decide ignores the lead, review-* puts it last.
night-workers.sh `start` has no unguarded grep; skip logic, default `codex agy claude`, and window creation when main is skipped are correct.
Every D-number cited in docs/QUESTIONS.md exists in docs/DECISIONS.md (D25-D27, D34-D38, D41-42, D51-54, D60-69, D76, D86-94, D102-D105) and matches its topic.

## Findings
1. low - scripts/night-workers.sh (start loop): an unknown program name is rejected inside the loop, so `start codex foo` starts the first run and then exits 1. Fix: validate all names before starting any.
2. low - scripts/night.sh:14: the STAGE_PREFER comment still says "tries that program first for every job"; now it leads builds and is last for reviews. Fix the text.
3. low - docs/QUESTIONS.md: Q-3/Q-4/Q-5 are listed both under 2026-11-18 and in the confirmed list; harmless duplication.

## Missing tests
None blocking; a STAGE_DRY check of `review-*` order with STAGE_PREFER set would pin the new behavior.
