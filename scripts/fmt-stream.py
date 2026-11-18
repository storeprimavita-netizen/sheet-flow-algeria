#!/usr/bin/env python3
"""Turn `claude -p --output-format stream-json` lines on stdin into a readable feed."""
import datetime, json, sys

def now():
    return datetime.datetime.now().strftime("%H:%M")

for line in sys.stdin:
    try:
        o = json.loads(line)
    except Exception:
        if line.strip():
            print("         " + line.strip()[:200])
        continue
    kind = o.get("type")
    inner = bool(o.get("parent_tool_use_id"))
    if kind == "assistant":
        for c in o.get("message", {}).get("content", []):
            if c.get("type") == "text" and c["text"].strip() and not inner:
                print("\n" + now() + "  CLAUDE: " + c["text"].strip()[:700])
            elif c.get("type") == "tool_use":
                i = c.get("input", {})
                name = c["name"]
                if name == "Skill":
                    print("\n" + now() + "  === STAGE: " + str(i.get("skill")) + " " + str(i.get("args", ""))[:80] + " ===")
                elif name == "Bash":
                    print("         . " + str(i.get("description") or i.get("command", ""))[:110])
                elif name in ("Edit", "Write"):
                    print("         . edit " + str(i.get("file_path", "")).split("sheet-flow-algeria/")[-1])
                elif name == "Agent":
                    print(now() + "  reviewer/agent: " + str(i.get("description", ""))[:90])
    elif kind == "result":
        print("\n" + now() + "  ===== BATCH ENDED =====\n" + str(o.get("result", ""))[:2500])
    sys.stdout.flush()
