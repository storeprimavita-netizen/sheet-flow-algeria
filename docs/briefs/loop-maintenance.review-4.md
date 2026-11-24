VERDICT: PASS

## Summary
Recheck of review-3 findings against `git diff --cached` (scripts/night.sh, stage.sh, night-workers.sh). `bash -n` passes on all three. Findings 1, 2, 3, 4, 5, 6, 7, 9 and 10 are fixed; 8, 11, 12 are unchanged and documented, as stated. No regression found in the touched lines.

## Confirmed fixed
1. night-workers.sh setup: an existing copy is only fast-forwarded, and KEPT when dirty or ahead of the remote; the hard reset runs only right after a fresh clone.
2. stage.sh end: exit 3 with LIMIT-UNTIL whenever a limited program exists, whatever the other entries did.
3. night.sh: lock directory with pid, stale lock replaced, removed in the EXIT trap (INT/TERM go through `exit`, so the trap runs).
4. night.sh start: dirty tree refused unless it is on `v3-<claimed id>` of this agent; `to_v3` saves it as a `wip:` step; `cut_off` sends the task through a build session first and parks it if the session leaves the wip commit as the last one. `.dev-port`, `.night-run` and `graphify-out` are gitignored, so dev-up does not make the tree dirty.
5. to_v3: pull retried 4 times, rebase aborted on each failure.
6. Role selection: whole-word match for ui and sec.
7. `agy models` reads /dev/null.
9. All python snippets use utf-8.
10. run_stage: waiting capped at 12 hours, reset after any non-limit result.

## Findings (all low, not blocking)
- low, scripts/night.sh lock: between `mkdir` and `echo $$ > pid` a second starter sees no pid and takes the lock over. Window is milliseconds; ignore.
- low, night.sh cut_off: a continue session that finds the work already complete and makes no new commit is parked as "cut-off work was not continued". Safe direction (parks, loses nothing).

## Missing tests
- night-workers setup run twice with an unpushed commit on a copy (finding 1).
- stage.sh with one program at its limit and one not signed in: expect exit 3.
- Two night.sh with the same name in one folder.
- A cut-off wip branch end to end. No whole task has been run end to end, as the script header says.
