VERDICT: FIX

## Summary
Reviewed `git diff --cached` (night.sh, stage.sh, night-workers.sh, gate.sh stamp and protected paths, docs). No brief; judged against the stated change. `bash -n` passes on all three scripts. Nothing touches main; the logic of the state machine is bounded (18 steps, two failed gates, same-state detection, three idle picks). Three medium findings can lose work or wrongly park a task. Earlier files review-1 and review-2 were PASS on other diffs, so this is not an ESCALATE.

## Findings
1. medium, scripts/night-workers.sh:setup (the `git -C "$d" fetch ... && checkout -q v3 && reset -q --hard origin/v3` line): runs for copies that already exist too. Running `setup` again while a worker has an unpushed commit on v3 (a failed push of a merge or park, exit 2 of step.sh) or leftover files on v3 destroys it. Fix: do the reset only right after a fresh clone; for an existing copy do `git pull --ff-only` and print KEPT when the tree is dirty or ahead.
2. medium, scripts/stage.sh end of file: exit 3 (wait) is returned only when `hard_fail = 0`. If codex is at its limit and another entry fails for any other reason (agy not signed in, claude missing a login), the stage exits 1. night.sh then counts it as a failed session: a build stage becomes "build produced no code twice" and the task is parked wrongly; picks fail three times and the run ends in minutes instead of waiting for the reset. Fix: return 3 whenever `until != 0` (a limited program exists that will come back), whatever the others did.
3. medium, scripts/night.sh (start): no lock. Starting `scripts/night.sh` by hand in a folder where `night-workers.sh start` (or another terminal) already runs the same name gives two coordinators on one checkout: both pick the same claimed row, one `to_v3` stashes or checks out under the other's session. Fix: `mkdir "$tmp/mnw-night-$name-$(pwd -P | cksum | cut -d' ' -f1).lock"` with the pid inside, refuse when that pid is alive, remove in the EXIT trap.
4. low, scripts/night.sh:to_v3: on a dirty task branch it commits and pushes everything with `step.sh` (`git add -A`) as a "wip" step. Started in a folder where the owner is working on a `v3-*` branch, the owner's half-done files are pushed. Fix: refuse to start when the tree is dirty at the beginning of the run.
5. low, scripts/night.sh:to_v3: `git pull --rebase` result is the function's result. A rebase conflict leaves the folder mid-rebase and the run ends with "could not update v3"; offline for a minute ends the whole night. Fix: `git rebase --abort` on failure, and retry a few times with a sleep before giving up.
6. low, scripts/night.sh (role selection): `case "$surf" in *ui*)` and `*sec*` match words like build, guide, section, so a brief with `surface: build tooling` starts the browser reviewer. Fix: match `*ui*` only as a whole word: `grep -qE '(^|[^a-z])ui([^a-z]|$)'`.
7. low, scripts/stage.sh:agy lane: `agy models` runs inside the `while read` loop without `</dev/null`; if it reads stdin it eats the remaining entries. The agy lane is untested (stated in the header).
8. low, scripts/stage.sh timeout: a session killed by the alarm (exit 142, empty reply) is treated like a failure and the next program starts the same job, up to three programs times 120 minutes. Child processes of the killed program survive. Acceptable, but say it in docs/NIGHT.md or set the next entry's limit shorter.
9. low, scripts/night.sh:park and scripts/stage.sh python snippets: `open(p)` without `encoding="utf-8"`; `python3 -I` ignores PYTHONUTF8, so under a C locale in tmux or launchd a non-ASCII MASTER_PLAN (em dashes) can fail or be rewritten wrong. Fix: `open(p, encoding="utf-8")` for read and write.
10. low, scripts/night.sh:run_stage: a limit that lasts days (monthly quota) makes the run poll every 30 minutes forever and send a notification each time. No session is spent while the cooldown file is valid, so cost is small; add a cap (for example stop after 12 h) so the terminal is not held.
11. low, scripts/night.sh:code_time: a task that changes only `docs/briefs`, MASTER_PLAN or PROGRESS never counts as built, so it is parked as "build produced no code twice". Fine for code tasks; note it in the Pick rules.
12. low, scripts/night-workers.sh:stop: `kill-session` after 3 seconds hangs up a running build; a row stays `claimed:<name>` and is picked again only by a run with the same name.

## Missing tests
- night-workers setup run twice with an unpushed commit on w2 v3 (finding 1).
- stage.sh with one program at its limit and one not signed in: expect exit 3 (finding 2).
- Two night.sh with the same name in one folder (finding 3).
- gate.sh stamp: the pass marker is written only on a clean tree and removed on failure (read and looks right; not exercised here).
- No whole task has been run end to end, as the script header says.
