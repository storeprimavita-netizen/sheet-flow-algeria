VERDICT: PASS

## Summary
Reviewed `git diff --cached` (stage.sh, night-workers.sh, stage-models.conf, docs). Both scripts pass `bash -n`.
`stage.sh models` ran against the real `agy models`: Neon is marked "not on this account", the Hydrogen entries resolve, and without the rules file every agy entry shows the "rules not written" mark.
The cache, the tab-split id lookup, the perl alarm (set before exec, so it survives) and the skip-with-`tried-1` path all behave under `set -uo pipefail`. In night-workers.sh the new `have` and the if/else block are safe under `set -e`.
No high or medium findings.

## Findings
1. Low, scripts/stage.sh agy_id: the pattern is an unanchored regex on the whole line (id and label), so a short pattern could match a different model. The conf patterns are full ids and do not collide (`hydrogen-high` vs `hydrogen-xhigh`). Fix later: anchor with `^`.
2. Low, scripts/night-workers.sh: it does not honour AGY_NO_RULES_OK, so tests that use the override still skip the agy run there. Intended per the brief; note only.

## Missing tests
None required; the agy session itself is not tested end to end (the header comment says so).
