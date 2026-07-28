# Phase 13 — Final sweep

**Read first:** CLAUDE.md, PROGRESS.md, `docs/design/DESIGN_SYSTEM.md`,
`docs/design/UI_AUDIT.md`, and the `cod-ui-polish` skill (step 8, final sweep).
This phase adds no features — it verifies the overhaul is complete and even.

## Goal

Cross-cutting correctness: contrast, keyboard, mobile, states, interconnection,
and a zero-hardcoded-color guarantee across the whole app in both themes.

## Tasks

1. **Interconnection sweep.** Click every KPI card, chart segment, wilaya row,
   agent/product rate, and category total — confirm each navigates to the
   filtered records behind it with filters shown as chips and encoded in the
   URL. Confirm every two-home record (expense, ad spend, task, order) creates
   and edits from both entry points through the same component. List any dead
   end and fix it.

2. **Contrast pass.** Every status pill, chip, and muted-text-on-surface
   combination checked ≥ 4.5:1 in **both** themes (use the `/design-preview`
   readout and spot-check real pages). Fix any that fail by adjusting the token,
   not the call site.

3. **Keyboard + a11y floor.** One full order flow (list → open sheet → change
   status → save) operated with keyboard only. Visible focus rings everywhere,
   `aria-label` on every icon-only button, `prefers-reduced-motion` honored,
   ⌘K + `?` overlay work. Kanban has a keyboard-accessible status select.

4. **Mobile.** Laptop-first, functional on tablet, and the **Confirmation queue
   + order detail sheet fully usable on a phone** (agents call from mobile).
   Sidebar collapses to the icon rail with tooltips.

5. **States on a cold/slow load.** Throttle and reload key pages: skeletons (not
   blank panels or spinners), empty states with a primary action, error states
   with a real reason + retry. Toasts on every mutation, undo where reversible.

6. **Hardcoded-color grep (whole repo).**
   `grep -rnE 'text-white|bg-white|text-black|bg-black|#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|glass-card|text-gradient'`
   over `src` must return **zero** outside the `globals.css` token definitions.

7. **RTL + i18n check.** Every new string is in `src/messages/{en,ar}.json`;
   AR/RTL layout correct (logical props); FR accents + an AR customer name
   render clean in the chosen face.

## Acceptance criteria

- Zero hardcoded colors (grep clean).
- Zero contrast failures on the design-preview readout; spot-checks pass.
- Full keyboard order flow works; mobile confirmation flow works.
- No dead-end numbers — every metric drills through.
- Every list/card/chart shows correct loading/empty/error/populated.
- **Screenshot self-critique**: a final both-themes pass of the primary screens
  into `docs/design/audit/final-*`; note in PROGRESS.md.
- `npm run build` + `npm test` green. This is the last planned phase — leave
  PROGRESS.md with a clear "overhaul complete" summary and any residual backlog.
