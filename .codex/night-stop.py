#!/usr/bin/env python3
"""Keeps a night run going in the Codex app (Stop hook, wired in .codex/hooks.json).

The loop-night skill creates the file `.night-run` in the project folder when a
run starts and deletes it when the run ends. While that file exists, this hook
answers "continue" each time the chat that runs the night run tries to stop.
It lets the chat stop when: the last message says `NIGHT RUN ended`, the run is
older than 16 hours, or it was told to continue 6 times in a row without any new
commit (stuck). Other chats in the same project are never told to continue.

Test:  echo '{"session_id":"s1","last_assistant_message":"x"}' | python3 -I .codex/night-stop.py
"""
import json, os, subprocess, sys, time

def git(*args):
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True, timeout=10).stdout.strip()
    except Exception:
        return ""

try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
root = git("rev-parse", "--show-toplevel") or os.getcwd()
flag = os.path.join(root, ".night-run")
if not os.path.exists(flag):
    sys.exit(0)

def end():
    try:
        os.remove(flag)
    except OSError:
        pass
    sys.exit(0)

# the skill writes the start time on line 1; this hook keeps its own state on line 2
lines = open(flag, errors="replace").read().splitlines()
try:
    started = int(lines[0].strip())
except (IndexError, ValueError):
    started = int(os.path.getmtime(flag))
try:
    state = json.loads(lines[1])
except (IndexError, ValueError):
    state = {}

if time.time() - started > 16 * 3600:
    end()
session = data.get("session_id") or ""
last = data.get("last_assistant_message") or ""
if state.get("session") and session and state["session"] != session:
    sys.exit(0)                      # another chat in this project: leave it alone
if not state.get("session"):
    # bind the run to the chat that actually started it
    try:
        mine = "loop-night" in open(data.get("transcript_path") or "", errors="replace").read()
    except OSError:
        mine = True
    if not mine:
        sys.exit(0)
    state["session"] = session
if "NIGHT RUN ended" in last or "NIGHT RUN not started" in last:
    end()

newest = git("for-each-ref", "--sort=-committerdate", "--count=1", "--format=%(objectname)", "refs/heads")
state["nudges"] = state.get("nudges", 0) + 1 if newest == state.get("commit") else 1
state["commit"] = newest
if state["nudges"] > 6:
    end()                            # six continues without a new commit: stuck, let it stop
with open(flag, "w") as f:
    f.write(str(started) + "\n" + json.dumps(state) + "\n")
print(json.dumps({"decision": "block", "reason": (
    "The night run is still on (file .night-run exists). Continue the loop-night skill: start the next task, "
    "or finish the task in progress. Do not ask the owner anything. If no task is eligible or a hard stop happened, "
    "print the final report whose last line is `NIGHT RUN ended · <why>` and delete .night-run.")}))
