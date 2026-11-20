VERDICT: ESCALATE

## Summary
Two reviewers ran: qa-reviewer (security/RLS; 53 tests pass, live RLS suite 5/5 not skipped) and ui-reviewer (live stack, simulated insets 47/34 at 390 px and 47/47/21 at 844x390 landscape, both themes, EN+AR).
Security holds: no high/medium. Review-2 #1 (header notch) and the bottom bar are verified fixed under a simulated inset.
Three MEDIUM safe-area defects remain from the same `viewportFit: "cover"` change: drawer top row under the notch, collapsed landscape sidebar crushed, main not clearing side insets.
Round 3 without PASS → ESCALATE per loop rule. Owner choice: (a) one more FIX round scoped to the three mediums, or (b) drop `viewportFit: "cover"` (removes the whole class of inset bugs; bar keeps `env()` padding harmlessly at 0).

## Findings (ranked)

### 1. MEDIUM: mobile drawer top row sits under the notch
- **Where:** `src/components/app-shell.tsx:343` — aside has `pb-[env(safe-area-inset-bottom)] ps-[env(safe-area-inset-left)]` but no top inset; brand row `h-14` at `:348`.
- **Failure:** with a 47 px top inset the brand link renders at y=5.5 (measured), under the status bar; on Dynamic Island (~59 px) the first nav item is clipped. Both reviewers found it independently.
- **Fix:** `pt-[env(safe-area-inset-top)]` on the aside (mobile drawer).

### 2. MEDIUM: collapsed sidebar in landscape is broken
- **Where:** `src/components/app-shell.tsx:343-344` — `ps-[env(safe-area-inset-left)]` inside `w-16`.
- **Failure:** iPhone landscape (≥ md) with sidebar collapsed: 64 px width minus 47 px inset leaves ~16 px; nav icons render at x=59–75 and spill into main. Evidence: `r3-admin-en-light-844-landscape-collapsed-inset.png`.
- **Fix:** add the inset outside the width, e.g. `w-[calc(4rem+env(safe-area-inset-left))]` / `w-[calc(16rem+env(...))]`, and shift main's `md:ps-*` offset to match; or move the inset to an inner wrapper and widen the aside.

### 3. MEDIUM: main content does not clear the left/right insets
- **Where:** `src/components/app-shell.tsx:428` — `p-4` / `md:p-8`.
- **Failure:** landscape, 47 px side inset vs 32 px padding: content sits ~15 px inside the notch on the far side (right in LTR, left in RTL). Phones narrower than 768 px in landscape (~667) get only 16 px.
- **Fix:** `ps-[max(1rem,env(safe-area-inset-left))] pe-[max(1rem,env(safe-area-inset-right))]` (and the `md:` 2rem equivalents), accounting for the sidebar on the start side.

### 4. LOW: sheets have no bottom inset (review-2 #2, open)
`src/components/ui/sheet.tsx:26` `inset-y-0 … p-6`: footer buttons sit in the home-indicator zone. Fix: `pb-[max(1.5rem,env(safe-area-inset-bottom))]`.

### 5. LOW: a same-day reverted delivery outcome still counts
`src/lib/my-day.ts:105` fetches only rows with `to_status` delivered/returned, so delivered → returning today still counts as Delivered. Fix: fetch all `stage='delivery'` rows today by me, count by the last row per order (same rule as confirmation).

### 6. LOW: nothing pins the courier filter (review-2 #5, open)
`src/lib/my-day.ts:104-107` relies on `orders!inner`; dropping it silently turns counts into workspace totals and the test at `my-day.rls.test.ts:105-125` still passes. Fix: fixture with an order delivered today assigned to a second courier; assert not counted.

### 7. LOW: "admin change" test half-asserts (review-2 #9, open)
`my-day.rls.test.ts:84-92` checks `cancelled` unchanged but not `callAgain` +1.

### 8. LOW: two "to confirm" counts (review-1 #10 / review-2 #3, open)
Admin bar/sidebar badge 18 (10 to confirm + 8 retry) vs dashboard "To confirm" tile 10. Label the badge or align the source.

### 9. LOW: delivery queue reads as personal (review-2 #4, open)
"Orders to deliver" is workspace-wide; add a "Team queue" qualifier.

### 10. LOW, pre-existing, follow-up rows: redirect loop for no-role / inactive profile (`my-day/layout.tsx:9`, `(app)/page.tsx:9` → dashboard → guard → orders …) and AR overflow at 768 px / 844 landscape (dashboard `scrollWidth` 806, "New order" at x=-13). Neither has a MASTER_PLAN row yet.

### 11. LOW: process
`PROGRESS.md` still says "Not done: screenshots". The builder never captured their own; this review supplies `r3-*` (below). The safe-area commit 3622625 landed after the `r2-*` shots.

## Missing tests (none added since review 2)
- `my-day/layout.tsx` guard: admin → `/app/dashboard`, agents pass.
- Root `/` redirect per role.
- Second-courier delivered-today fixture (finding 6); delivery revert (finding 5); `countMyChanges` tie on equal `created_at`.
- Bottom bar: active state on sub-routes, 99+ cap, hidden ≥ md, focus returns to More on drawer close.
- Safe-area classes present on header, drawer, main.
- My day loading and error render states.

## Evidence
`docs/design/audit/NAV-5/r3-*.png` (390 px shots have the simulated inset applied by rewriting `env(safe-area-inset-*)` in compiled CSS):
admin EN light/dark + AR dark at 390, drawer EN dark + AR (rendered light, theme is cookie-driven) at 390, admin EN dark at 768 (no bar), admin landscape 844 EN light expanded + collapsed and AR dark; confirmation agent EN dark / AR light; delivery agent EN dark / AR light.
Verified: header 103 px with buttons at y=58 under a 47 px inset; bar items end at y=810 (844−34) for all roles; main `pb` 114 px clears the bar; no horizontal scroll at 390 EN/AR; expanded landscape sidebar inset correct LTR and RTL; no money on agent My day; admin `/app/my-day` → dashboard; `auth/callback` `next` same-origin only.
