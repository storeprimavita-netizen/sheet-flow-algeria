risk: low · surface: ui · lane: shell
(plan row = screenshots owed; no code, no migration, no new DECISIONS row)

# NAV-5-G — NAV-5 screenshots at 390 px + real-phone checklist

Goal: take the screenshots NAV-5/NAV-5-F owed (no browser MCP then), fix only what they show, record the real-phone check as owner-owed.

## Done when
- Screenshots saved in `docs/design/audit/NAV-5/g-<role>-<lang>-<theme>-<w>.png` for: admin (dashboard, orders), confirmation agent (My day populated + empty), delivery agent (My day), More drawer open (admin + one agent); each at 390 px, EN+AR, light+dark. 1280 px: admin and one agent show no bottom bar. 768 px AR + 844 px landscape AR: measure the overflow NAV-5-F (d) could not re-measure.
- Checked on each shot: header 56 px, bar 44 px targets, active state + counter badge ("99+" fits), page bottom not hidden by bar, AR bar order mirrored, no hardcoded-color look, `<meta name="viewport">` has no `viewport-fit`.
- Any defect found is fixed in the touched file, with a test if it is logic/classes; otherwise PROGRESS.md says "clean".
- PROGRESS.md block lists the shots and says plainly: real iPhone/Android check NOT done (no device) and stays owner-owed; review-1 low #9 (iOS bottom padding 0 without `cover`) stays open per D87.
- Gate green.

## Facts found in code
- Plan row (NAV-5-G) differs from D87 item 7, which gave NAV-5-G a different text (no-role / inactive profile redirect loop, risk H, sec). The plan row is what was written at ship of NAV-5-F; D87's loop fix is NOT in this task and no `no-access` page exists in `src`. Not built here; flagged below.
- Existing shots: `docs/design/audit/NAV-5/` has 30 files (r2-/r3- with inset code since reverted by D87, plus unprefixed first-round); none is of the current v3 lines, hence the `g-` prefix.
- Seed users (`scripts/seed-dev.ts`): admin@seed.mnw, confirmation@seed.mnw, delivery@seed.mnw, password `SeedDev!2026`. Empty My day needs a user/day with no tasks/meetings: use delivery or clear via seed state, do not edit data in the DB by hand beyond local seed.
- Files in scope if a fix is needed: `src/components/app-shell.tsx`, `mobile-bottom-bar.tsx`, `nav-model.tsx`, `src/app/(app)/app/my-day/*`, `src/messages/{en,ar}.json` (parity).

## Steps (commit + push each)
1. `scripts/dev-up.sh`; seed (`scripts/db-reset.sh` only if the seed is missing; local only).
2. With chrome-devtools: emulate 390x844 mobile, login per role, take the shots, EN then AR (locale cookie), dark then light.
3. 1280 px, 768 px AR, 844x390 landscape AR shots + measure overflow.
4. Fix defects found (one commit each), re-shoot the fixed screen.
5. PROGRESS.md block; set row done at ship.

## Acceptance (by name)
No new tests unless a fix adds logic: then a class/logic test beside the existing `mobile-bottom-bar.test` / `nav-model.test`. Existing suites must stay green (gate).

## Edge cases
- If no browser MCP / app cannot start: say so in PROGRESS.md, task stays not-done (do not tick as done).
- Do not re-add `viewportFit: "cover"` or inset classes (D87, NAV-5-F e).
- Keyboard-open bar floating cannot be emulated; list under real-phone check.

## Needs owner (not blocking this task)
- D87's no-role/inactive redirect-loop fix has no plan row now; owner/decide should confirm whether a new task is wanted (needs a DECISIONS call, risk high). Real-phone check: owner-owed.
