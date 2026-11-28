VERDICT: FIX

## Summary
- On the running app the crumb code is correct: no `<bdi>`, Arabic names keep their start (EN and AR), "Preview" shows in full and the record gives way.
- `scripts/gate.sh` is OK; the three named tests exist and are meaningful.
- One medium: the screenshot matrix (fourth "Done when" item, a D110 medium) is not delivered.

## Findings
1. **Medium** - `PROGRESS.md:1136-1137`
   - Failure: `docs/design/audit/NAV-2-G/` does not exist and PROGRESS says the matrix was not taken. This is one of the two NAV-2-F mediums this row exists to close (D110). The app does run in this worktree.
   - Fix: run `scripts/dev-up.sh`, capture the brief's matrix (EN/AR, dark/light, 1280/390, three roles) and the 640/700/768 preview sweep, fix what it shows, replace the PROGRESS note with the shots taken and each skip, then run `scripts/dev-down.sh`.
2. **Low** - `src/components/breadcrumbs.tsx:86-88`
   - Failure: on preview at 390 px with a long record, the parent "Product pages" shrinks to 24-32 px of about 94, while "Preview" and the record keep their room. Parents could already shrink below `sm` before this diff.
   - Fix: none required for this row; backlog it if wanted.

## Missing tests
None beyond the brief. Truncation geometry cannot be tested without a DOM.

## Checked on the running app
- Preview record text width with substituted long names (px):

| Interface | 390 | 640 | 700 | 768 |
|---|---|---|---|---|
| EN | 120-127 | 59 | 119 | 83 |
| AR | 121-129 | 105 | 165 | 99 |

- The tail was never cut and there was no horizontal page scroll. The record stays above about 4 characters at 640-768, so parents need not shrink up to `md`.
- Sampled: product pricing, order, store page editor, expenses, accounts, team hub, confirmation agent (own and missing order), delivery agent (inaccessible order). No console errors on the pages checked.

## Not checked
The full matrix; the sell, money and catalog hubs; the product page without `/pricing`; preview at 1280; loading and error states, focus and contrast.
