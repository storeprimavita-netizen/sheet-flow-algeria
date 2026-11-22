VERDICT: PASS

## Summary
Reviewed the uncommitted diff (dev-lib.sh, dev-up/down/watchdog, codex-night, docs, MASTER_PLAN row). No brief exists; judged against the stated change. Syntax checks pass. Ownership check (listener cwd == pwd -P) correctly prevents stopping another program's port in dev-down and the watchdog. No high or medium findings.

## Findings
1. low, scripts/dev-down.sh:~19: `pkill -f "scripts/dev-watchdog.sh $port"` is not folder-scoped, so a sibling clone's watchdog on the same port number could be killed; also matches port prefixes (3000 vs 30001). Fix: anchor on "$(pwd)/scripts/dev-watchdog.sh $port$" or use the pidfile.
2. low, scripts/dev-lib.sh `mine`: only the first listener PID is checked (IPv4/IPv6 sockets can differ). Harmless in practice.
3. low, scripts/codex-night.sh: `date -v` is BSD-only (macOS); fine since the script already uses caffeinate.
4. low, scripts/dev-up.sh: if the dev server is mine but compiling more than 5 s, app() fails and the 60 s wait loop absorbs it; no double start because of `mine ||`. No change needed.

## Missing tests
No automated tests for the scripts. Manual check suggested: hold :3000 with another process, run dev-up (expect 3001), then dev-down (the other process must survive).
