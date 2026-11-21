#!/usr/bin/env python3
"""Second wall for Codex shell commands (the first is .codex/rules/mnw.rules).

Rules match word by word, so a command wrapped in a redirect or a variable can
slip past them. This hook reads the whole command text and blocks the things
agents never do here. Wired in .codex/hooks.json (PreToolUse, Bash); Codex runs
it only after the owner has trusted it with /hooks.
Exit 2 + a reason on stderr = blocked. Exit 0 = let the rules and sandbox decide.
Test:  echo '{"tool_input":{"command":"git push origin main"}}' | python3 -I .codex/guard.py
"""
import json, re, sys

try:
    cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
except Exception:
    sys.exit(0)
if isinstance(cmd, list):
    cmd = " ".join(str(c) for c in cmd)

BLOCK = [
    (r"\bgit\b[^\n;&|]*\bpush\b", "push with scripts/step.sh (commit + push) or scripts/push.sh — never raw git push, never main, never forced"),
    (r"\bgit\b[^\n;&|]*\breset\b[^\n;&|]*--hard", "never git reset --hard; stash instead"),
    (r"\bsupabase\b[^\n;&|]*\b(db\s+(push|pull)|link|login)\b", "the remote database is the owner's"),
    (r"--linked\b", "the remote database is the owner's"),
    (r"\b(npm|pnpm|yarn)\s+(run\s+)?dev\b|\bnext\s+dev\b", "start the app with scripts/dev-up.sh"),
    (r"(^|[\s;&|(])sudo\s", "no sudo"),
    (r"\bvercel\b[^\n;&|]*(--prod|\bdeploy\b)", "production deploys are the owner's"),
]
for pattern, reason in BLOCK:
    if re.search(pattern, cmd):
        print("BLOCKED by project rule: " + reason + ". Do not look for another way to do the same thing.", file=sys.stderr)
        sys.exit(2)
sys.exit(0)
