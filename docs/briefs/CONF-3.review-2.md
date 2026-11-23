VERDICT: PASS
Reviewer model: claude-opus and codex ui-reviewer

## Summary

The recheck confirmed distinct unresolved and unlinked states, unchanged grants, agent lifetime-value exclusion, and recent orders ahead of undated rows. At 390 px, the reviewed table and Kanban cards opened upward with 439–459 px of history space. The full repair gate passed with 1,414 tests and live RLS.

## Findings

- **Fixed · review 1 #1, #2 and #5.** Link states are explicit in the scoped DTO and translated in both languages. The index and query order undated rows last. The card chooses the side with more room when it opens.
- **Low · Confirmation score row.** The row wording can still suggest no saved history when the card finds a customer by phone. Distinguish the absence of a saved link, a phone match, and a parse failure.
- **Low · customer score queries.** A resolved lookup still incurs the scoped delivery cohort calculation. The cost is recorded in DB.md and PROGRESS.

## Coverage gaps

- Component-level coverage could exercise unresolved versus unlinked rendering, phone-match copy, and a pending response after a scoped remount.
- The UI recheck used English dark at 390 px with the confirmation-agent role. It did not create an unresolved fixture independently or repeat the full visual matrix. The live RLS suite covers the unresolved case.
