risk: low · surface: ui · lane: shell

# NAV-2-H — every NAV-2-G screenshot shows what its name says

Goal: retake the wrong shots in `docs/design/audit/NAV-2-G/` and make PROGRESS.md true (D111, `NAV-2-G.review-2.md` finding 1). No migration, data, permission or message-key change; no code change expected.

## Done when
- The 7 shots named by the review show a loaded page (no skeleton) with the record crumb their name promises.
- Every file ending `-390` is a real 390 CSS px viewport: `sips -g pixelWidth` gives 780 (DPR 2).
- Each other file's width is twice the number in its name.
- A long Latin name at 390 is taken, or listed as skipped for every width.
- Every retaken shot was opened with Read and checked against its name.
- PROGRESS.md has the true shot count, no "nothing needed fixing" claim that the shots contradict, and the full skip list.
- `scripts/gate.sh` is OK.

## Facts checked (v3 at claim)
- The folder holds 30 jpegs, not 45.
- **Beyond the row:** all 14 files named `-390` are 1000 px wide, so they were shot at 500 CSS px (desktop Chrome will not resize narrower). Retake all 14, including the 3 the review named (`accounts-ar-light`, `order-ar-light`, `preview-{en,ar}-dark`: 4 files).
- `preview-longname-ar-text-en-light-700.jpeg` confirmed wrong: the long name replaced the group crumb, not the record.
- With a tail, the record is the second-to-last `li` of the breadcrumb `ol` (`src/components/breadcrumbs.tsx`, `CrumbList`); without a tail it is the last.
- The record crumb is set by a client effect (`CrumbRecord`), so it appears after the server content. Users of it: order page, product layout, store page, store preview.
- `PROGRESS.md` section `## NAV-2-G` holds the wrong count, claim and skip list.
- `.env.local` and `node_modules` exist in this worktree.

## Capture method
- `scripts/dev-up.sh`; use only the address on the `UP app` line. Admin: `scripts/seed-dev.ts`.
- Phone widths: chrome-devtools `emulate` with viewport `390x844x2,mobile,touch` (not `resize_page`).
- Before each shot, `wait_for` / `evaluate_script` until no skeleton is left and the record `li` holds the record text (`ol li:last-child`, or second-to-last on preview).
- Long names: replace the record's text and `title` in the browser only, then check which `li` changed. Never edit local data.
- Theme and language must match the file name; check both on the image.

## Files and steps (each pushed with `scripts/step.sh`)
1. `docs/design/audit/NAV-2-G/`: retake under the same names:
   - 1280: `product-en-dark`, `order-en-dark`.
   - 390: `accounts-ar-light`, `expenses-ar-light`, `order-ar-light`, `product-ar-light`, `product-pricing-ar-light`, `store-page-ar-light`, `hub-{sell,money,catalog,team}-ar-light`, `preview-{en,ar}-{dark,light}`.
   - `preview-longname-ar-text-en-light-700`; check the other five long-name shots and retake any that is wrong.
   - New: `preview-longname-latin-en-light-390.jpeg`.
2. `PROGRESS.md`: rewrite the `## NAV-2-G` matrix lines (31 files if the new shot is taken; what was retaken and why; skips). Add what NAV-2-H found. `scripts/dev-down.sh`.

## Acceptance
- No new tests; `breadcrumbs.test.tsx` stays green.
- `for f in docs/design/audit/NAV-2-G/*.jpeg; do sips -g pixelWidth "$f"; done` matches every name.
- Console on the record pages has no errors.

## Skips to list in PROGRESS (not part of this task)
- Language / theme / width combinations not in the matrix for non-preview screens; hubs at 1280, EN and dark.
- Confirmation-agent and delivery-agent shots; missing and inaccessible order pages.

## Edge cases
- A real 390 px viewport was never in this matrix and may show a layout defect. A small defect in the breadcrumb: fix it with a test and note it. Anything else: one line in `docs/BACKLOG.md` (a follow-up gets no follow-up, D40/D89).
- A missing record crumb after a long wait is a defect, not a timing problem: check the DOM and console.
- "#1001" has no strong letter and stays `ltr`; that is expected in Arabic.
- No browser MCP or app down: say so and park; do not mark the shots done.
- No new DECISIONS row needed.
