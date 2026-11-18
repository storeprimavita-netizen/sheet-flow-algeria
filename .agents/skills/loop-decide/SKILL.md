---
name: loop-decide
description: Loop decision step on the MNW project — when a task raises a question, either decide it and record it in docs/DECISIONS.md, or log it in docs/QUESTIONS.md for the owner and let other work continue. Use whenever a brief or review says the owner must decide, or a task would otherwise stop on a question.
---
Follow the body of `.claude/commands/decide.md` exactly (ignore its frontmatter). Use your strongest model for this step. If you have no way to notify the owner's phone, the entry in `docs/QUESTIONS.md` is the notification — commit and push it, then continue with other tasks. Never decide credentials, what customers are charged, profit rules, role permissions, data deletion or spending.
