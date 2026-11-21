---
name: loop-decide
description: Loop decision step on the MNW project — when a task raises a question, either decide it and record it in docs/DECISIONS.md, or log it in docs/QUESTIONS.md for the owner and let other work continue. Use whenever a brief or review says the owner must decide, or a task would otherwise stop on a question.
---
Decisions are made by the model chosen for that job (`.agents/models.conf`, role `decide`: Gemini 4 Neon first — the part Fable plays in Claude Code).

1. Run `scripts/agy-run.sh pick decide`. If it prints the model this session is already running on, decide here: go to step 3.
2. Otherwise hand the question over:
   ```
   scripts/agy-run.sh run decide --expect-text '^DECIDE-END:' -- "You are the decision step of the MNW loop. Follow the body of .claude/commands/decide.md (ignore its frontmatter) for this question — task <id>: <the question, where it came from, the options>. Record the result and push it with scripts/step.sh. End your reply with the line: DECIDE-END: decided D<n>   or   DECIDE-END: asked Q-<n>"
   ```
   Read the decision it recorded and continue. If the command ends with `MODEL-USED: none`, go to step 3.
3. Follow the body of `.claude/commands/decide.md` exactly (ignore its frontmatter) yourself.

If you have no way to notify the owner's phone, the entry in `docs/QUESTIONS.md` is the notification — commit and push it, then continue with other tasks. Never decide credentials, what customers are charged, profit rules, role permissions, data deletion or spending.
