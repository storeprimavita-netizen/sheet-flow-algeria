VERDICT: PASS

## Summary
Re-check after review-9 (FIX: NIGHT.md named the wrong approval policy).
Fixed: NIGHT.md now says scripts/stage.sh uses `never` (stage.sh:163) while .codex/config.toml:15 keeps `on-request`.
`default_tools_approval_mode` is stated as read from the installed Codex, not yet tried.
Rest of the diff is only `--isolated` added to the chrome-devtools args in .mcp.json, .agents/mcp_config.json, .codex/config.toml. No regression, no other change.

## Findings
None high or medium.
