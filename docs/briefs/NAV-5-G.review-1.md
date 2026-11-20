VERDICT: FIX

## Summary
Reviewer: ui-reviewer (surface ui, risk low). The diff contains only screenshots and a PROGRESS block. Most shots are real, but the evidence does not back three "Done when" items:
- one shot is a blank capture;
- the "99+" claim has no shot behind it (the badge99 file is a byte-identical copy of the More drawer shot);
- the empty My day state was never shot, yet the block is headed DONE.
There is no code change, so these are evidence fixes only.

## Findings (ranked)

1. **HIGH — `docs/design/audit/NAV-5/g-admin-orders-ar-dark-390.png`: blank capture.** The file is 26 KB and shows only a dark rectangle: no header, content or bar. The other three orders shots are 130–145 KB. PROGRESS.md:815 still claims orders is covered in AR dark. Fix: wait for the page to load, re-shoot, and confirm the image shows the header, table and bar.

2. **MEDIUM — `g-conf-badge99-ar-dark-390.png` is the same file as `g-conf-more-ar-dark-390.png` (md5 e2e9402b…).** It shows the More drawer with an "18" badge. Every shot shows "18" or "8", so nothing proves the claim at PROGRESS.md:816 that '"99+" badge fits inside its link'. Fix: force a count of 100 or more locally (temporary local seed rows, or a DOM text override labelled as such). Capture the bar in AR and EN at 390 px, replace the duplicate file, and reword the claim to match the evidence.

3. **MEDIUM — Empty My day state was not shot (brief "Done when": confirmation agent My day populated + empty).** PROGRESS.md:817 admits it is "Not covered", but the heading at PROGRESS.md:814 says DONE. The brief's edge case says an item the browser cannot deliver keeps the task not-done. The "No open tasks" card is not the empty state, because the meeting and counts still render. Fix: on the local stack, give one seed user a day with no tasks or meetings (complete or delete the seeded meeting locally, or pick a date with no data). Shoot it in EN and AR, light and dark, at 390 px.

4. **LOW — The "page bottom not hidden by bar" check is not visible in the shots.** The 764 < 792 numbers come from a scrolled-to-end measurement. The unscrolled My day EN dark shot shows the "Next meeting" card cut off under the bar, which is expected without scrolling. Fix: add one scrolled-to-bottom shot per role, or state that the check is numeric only.

5. **LOW — The Next.js dev "N" overlay covers the first bar item in every shot**, hiding that item's active state and badge area. Fix: re-shoot with the dev indicator disabled or on a production build (`next build && next start`).

6. **LOW — Thin coverage at 1280, 768 and 844x390.** Each is one AR dark shot. That is acceptable under the brief, but noted.

7. **LOW — PROGRESS.md:814, heading wording.** Change "DONE (screenshots)" to "partial" until items 1–3 are closed. The real-phone line and the review-1 low #9 / D87 line are correct.

## Missing tests / evidence
- A good admin orders AR dark 390 shot.
- A "99+" badge shot (AR and EN).
- Empty My day shots (EN and AR, light and dark).
- A scrolled-to-bottom shot.
- A gate run on the final commit (the brief requires gate green; none is recorded).
