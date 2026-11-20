VERDICT: ESCALATE

## Summary
Round 4 (D63) on `git diff e8c5dc7..origin/v3-CONF-1` (1ed5768). qa-reviewer: the sync object and both callers; vitest 22/22 pass. ui-reviewer: live under Slow 4G / Slow 3G; all of D63 item 4 passes on screen. Two medium findings remain (#1 and #2 below), so this is not a PASS. n = 4 ≥ 3 without a PASS, and D63 (5) says anything but PASS parks the task for the owner as `blocked:` (no round 5). The `hold()` deviation fixes a race that D63's four-entry design really has, but in its current form it is too broad and too narrow at once (#2, #3).

## Findings (ranked)

1. **MEDIUM: status picked, then typing while that page loads: the status is lost (breaks D63 1c "whatever the timing").** `src/components/fields/search-param-sync.ts:58`: `fire` builds from `lastQs` and ignores the address `mergeInto` just pushed. Steps on the real object: `seen("view=a")` → `type("Ami")` → `mergeInto` pushes `view=a&status=no_answer&q=Ami` → `type("Amina")` → write is `view=a&q=Amina`. That `router.replace` overrides the pending status push and the picker reverts. The reviewer confirmed this in the code. Note: D63 (2) says "build from the query string last seen", so the hole is in the decided design itself. Fix: build from `sent.at(-1) ?? lastQs`. An outside change already clears `sent`, so 1b still holds.

2. **MEDIUM: the `hold()` deviation is too broad and too narrow.** `src/components/fields/search-param-input.tsx:49-60` and `search-param-sync.ts:103-107` (`holdDelay` 5000). Why it exists: without it, the 300 ms write fires on the old address while a view-pill or Reset navigation is still loading, and its `replace` overrides that navigation. That reopens review-3 #1 under throttling, so the deviation has a real cause. Three problems:
   - (a) **Too broad.** The listener matches every `a[href], button` except the box and the picker. Live repro (ui) on Slow 4G: type "Amina", then press "Compact rows" 100 ms later. The search reaches the address only after about 6.3 s, and the table stays unfiltered for that time. The same happens with Columns, theme, sidebar, user menu, row actions and Refresh. "Save as view" / "Save" / "Save as" read `effective` from the address (`saved-view-bar.tsx:41,97`), so a view saved inside that window leaves out the typed search. This last point is from the code; it was not saved live.
   - (b) **Too narrow.** Keyboard activation (Tab to a view pill, Reset or Default, then Enter) fires no pointerdown, so the stale write still goes out at 300 ms and the view opens Modified with `q=…`. A navigation slower than 5 s (slow 3G, cold server) has the same result once the hold expires.
   - Fix: hold or cancel on capture-phase `click` as well as `pointerdown`. Cancel outright on an `a[href]` to a different URL (1b drops the unsent text anyway). Do not hold for buttons that leave the address alone. Make the Save paths send the box text first, through the box handle's `mergeInto` or a `flush`.

3. **LOW: Save does not cancel the waiting write (D63 1b names Save).** `src/app/(app)/app/orders/saved-view-bar.tsx:39-46`. Save is `save()` + `router.refresh()`. When the saved search is unchanged, neither the address nor `inherited` changes, so `seen` never runs: the user sees "Saved", and about 5 s later the view flips back to Modified with the typed search. Fix: Save goes through the box handle (see #2), or record it in CONF-1-F.

4. **LOW: `pairKey` can collide.** `search-param-sync.ts:27-32` joins decoded `k=v` pairs with `&`, so typing `a&status=x` matches an outside address `q=a&status=x`. Contrived. Fix: compare `JSON.stringify` of the sorted entries.

5. **LOW: a slow navigation can outlast the hold.** Same cause as #2(b) on pointer input. It was not reproduced live (navigation took about 3 s on Slow 3G in dev); the outside-change path fixes it afterwards, but the timing is wrong.

6. **LOW (pre-existing): misleading empty state.** A search with no matches shows "Queue is empty. New orders will appear here" plus a "New order" button. It should say there are no matches for the search or filter and offer to clear them. Screenshot `docs/design/audit/CONF-1/review-4-3-queue-ar-light.png`. Belongs in CONF-1-F.

Live checks that pass (ui, throttled): D63 item 4 checks 1-5; queue bar in EN dark and AR light (logical RTL layout intact); "Save as mine" hidden on a personal view and shown on shared views; back/forward drops unsent text as 1b says. Caveat: events were scripted (input + pointerdown + click) because the 300 ms window is shorter than separate tool calls; a shared Chrome kept redirecting the tab, so `review-4-1-noanswer-en-dark.png` is not evidence for check 1. Not covered live: real touch taps, keyboard-only activation, page and sort links on their own.

## Missing tests
- Status picked, then more typing before the echo: the write must keep the status (#1).
- Echo with its params reordered is still treated as the box's own write (D63 says "order ignored"; untested).
- `seen` with the same query string but a changed `inherited` counts as an outside change.
- `hold()` then more typing: the timer goes back to 300 ms; `hold()` with no timer does nothing; `cancel` clears a hold.
- (a) never checks that no second write comes later; (f) never checks that nothing is sent before 300 ms after the last key.
- The pointerdown/click listener cannot be tested without a DOM environment (D55/D59), so it needs a live check that includes keyboard activation.

## Owner decision needed
Per D63 (5), park CONF-1 as `blocked:` with #1 and #2 open. Owner options: allow one narrow round 5 for #1 (a one-line fix plus a test) and #2 (cancel on a link click, Save goes through the handle), or accept and move #2/#3 to CONF-1-F. CONF-2, CONF-3 and CONF-4 wait on this.
