#!/usr/bin/env python3
"""Classify how a `claude -p --output-format stream-json` run ended.
Prints one line: LIMIT <reset time or ->  |  MORE  |  NOTHING  |  HARDSTOP  |  UNKNOWN
Only the final result (or, without one, the last assistant text) is inspected,
so words like "rate limit" inside a task description cannot trigger a wait."""
import json, re, sys

last_result, last_text = None, ""
for line in open(sys.argv[1], errors="replace"):
    try:
        o = json.loads(line)
    except Exception:
        continue
    if o.get("type") == "result":
        last_result = o
    elif o.get("type") == "assistant" and not o.get("parent_tool_use_id"):
        for c in o.get("message", {}).get("content", []):
            if c.get("type") == "text" and c["text"].strip():
                last_text = c["text"]

text = str(last_result.get("result", "")) if last_result else last_text
if re.search(r"hit your [^\n]{0,40}limit|usage limit reached|limit reached", text, re.I) and len(text) < 400:
    m = re.search(r"resets?\s+(?:at\s+)?(?:[A-Za-z]{3,9}\s+\d{1,2},?\s+)?(\d{1,2}(?::\d{2})?\s*[ap]m)", text, re.I)
    print("LIMIT " + (m.group(1).replace(" ", "") if m else "-"))
elif "RUN-END: nothing-eligible" in text:
    print("NOTHING")
elif "RUN-END: hard-stop" in text:
    print("HARDSTOP")
elif "RUN-END: more" in text:
    print("MORE")
else:
    print("UNKNOWN")
