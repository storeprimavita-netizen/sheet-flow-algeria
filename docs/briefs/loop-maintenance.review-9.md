VERDICT: FIX

## Summary
- `--isolated` exists in chrome-devtools-mcp@1.13.0 (temporary user-data-dir, cleaned up on close). Applied in all three configs.
- .mcp.json and .agents/mcp_config.json parse; .codex/config.toml parses; the diff touches only the chrome-devtools args (plus one TOML comment).
- docs/NIGHT.md misstates the Codex setting (finding 1).

## Findings
1. MEDIUM - docs/NIGHT.md (new "STILL OPEN" bullet): says `approval_policy = "never"`. .codex/config.toml:15 has `approval_policy = "on-request"` and line 16 `approvals_reviewer = "auto_review"`. The note records an owner decision, so a wrong setting name misleads it. Fix: write `approval_policy = "on-request"` with the automatic reviewer and no one to click, or drop the literal value.
2. LOW - NIGHT.md refers to `default_tools_approval_mode = "approve"` as a Codex key; the key was not verified here against Codex docs. Phrase it as "to check" or confirm the name before the owner acts on it.

## Missing tests
None needed (config only).
