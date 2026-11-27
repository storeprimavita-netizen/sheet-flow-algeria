VERDICT: PASS

## Summary
Re-check of review-7 by qa-reviewer under bash 3.2 (bash -n clean on all six scripts; tmux tests on private sockets).
All 7 findings are fixed: ended-<w> windows, per-run runner temp folder, env unset / stage_run prefix, full-path watchdog, single `finish`, claimed_count, comment.
No recursion or double run of `finish`; the rm -rf guard only fires for a mnw-runner-?????? folder; tmux quoting works.
No high or medium findings. Two low nits below.

## Findings
1. LOW, scripts/night.sh:146. In a `case` pattern `?` also matches `/`, and the guard does not check the folder is directly under `$tmp`. Contrived: `NIGHT_ROOT=x bash /x/mnw-runner-a/bcde/night.sh` would delete that folder. No code path produces it. Fix: also require `"$tmp"/mnw-runner-*` with no `/` after the prefix, or pass the folder explicitly.
2. LOW, scripts/night-workers.sh:94. tmux matches window names by prefix when no exact match exists: `kill-window -t mnw:ended-w2` can kill `ended-w20`. Only an ended window, needs 20+ leads. Fix: target `"$session:=ended-$w"`.

## Missing tests
- Regression for the far-limit and 12-hour `finish` paths (stand-in stage).
- `running()` and `status` against an `ended-<w>` window.
- Runner folder removed on a refused start.
