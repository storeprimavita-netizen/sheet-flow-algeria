VERDICT: FIX

## Summary
qa-reviewer (opus) tested under /bin/bash 3.2. Gate not weakened. Re-exec cannot loop, keeps folder and arguments; Ctrl+C gives 130; limit parsing correct; vitest exclude correct; dev-up never kills a server.
One medium finding (night-workers running() counts ended windows). Six low findings.

## Findings

1. MEDIUM - scripts/night-workers.sh:56, :73. `running()` counts any window named `<w>-*` as live. After a run ends normally (including "usage limit until <date>") the window stays on "press Enter", so `start` says "running ... left as it is" / "nothing started" and `status` says running. With bash in tmux the same after Ctrl+C; with zsh the window closes and the final output is lost. The documented way back fails. Fix: rename the window on exit (`tmux rename-window -t "$TMUX_PANE" "$w-ended"`) and match only live names, or use `#{pane_dead}` / `#{pane_current_command}`.
2. LOW/MEDIUM - scripts/night.sh:35-41, :58. Copy folder is per project folder and refreshed before the lock check, so a refused second start replaces stage.sh and stage-models.conf under a live run (contradicts NIGHT.md). Fix: `mktemp -d` per run, removed in the EXIT trap, or lock before copying.
3. LOW - night.sh:42, :46. NIGHT_ROOT, NIGHT_HOME, STAGE_ROOT, STAGE_CONF are exported to sessions and gate.sh; a test copy of night.sh/stage.sh in a scratch repo would cd into the real project. Fix: unset NIGHT_ROOT NIGHT_HOME after cd; pass STAGE_* only as prefix on the stage calls.
4. LOW - scripts/dev-up.sh:50 with dev-down.sh. Watchdog pgrep/pkill patterns lack the folder; when this folder lost the port `.dev-port` is removed, dev-down falls back to 3000 and kills the winner's watchdog (never a server). Fix: include the folder path in the watchdog args and patterns.
5. LOW - night.sh:124. `exit 0` inside run_stage on a >12h limit skips final to_v3 and the PROGRESS run report. Fix: set `why` and take the normal finish path.
6. LOW - night.sh:263-277. With two rows `claimed:$name`, `claimed()` returns the first, so the pick question is decided under the wrong task (how P1-5 got CONF-6's question). Fix: count claimed rows after pick; keep `ask` only for the just-claimed row.
7. LOW - stage.sh:143. Trap waits for the child; a child in its own process group or ignoring SIGINT delays Ctrl+C up to the timeout (120 min).

## Missing tests
limit_secs on fixed samples; stage.sh with fake codex/claude/agy on PATH (Ctrl+C 130, far limit + failure = 1, far limit + nothing else = 3, near limit = 3); night.sh re-exec in a scratch repo (args, folder, no loop); running() against an ended window; two dev-up starts racing for one port.

## Checked, no finding
MASTER_PLAN P1-5/P1-6 back to todo matches D106/D107/D109; execute.md and SKILL.md wording matches decisions; vitest exclude only drops .worktrees copies.
