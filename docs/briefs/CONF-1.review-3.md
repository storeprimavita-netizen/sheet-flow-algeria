VERDICT: ESCALATE

## Summary
Round 3 (`git diff ccafbe5..074b27e`) was reviewed by qa-reviewer (risk high) and by ui-reviewer (surface ui, live as admin, AR, desktop and 390 px).
- Review-2 #2 (status options) is FIXED. Review-2 #6 ("Save as mine" on personal views) is FIXED.
- Review-2 #1 (the search box follows the URL) is only partly fixed. The new sync effect also adds a regression where keystrokes are lost.
- This is review 3 and it did not pass, so the rule sends it to the owner: either one more FIX round, or accept with the search race filed as CONF-1-F.
- Test views: ui-reviewer's "R3TEST" was deleted (DB check `DELETE 1`).

## Findings

### 1. MEDIUM: switching view or pressing Reset within 300 ms re-applies the typed search (review-2 #1 still open)
`src/components/fields/search-param-input.tsx:38-41` and `:43-54`.
- The sync effect depends on `fromUrl`, so it only runs when that value changes. When neither the old nor the new view has `q`, `fromUrl` stays `""` and the effect never runs.
- The debounce effect re-runs because `sp` changed, and it re-arms the timer with the old typed value.
- Reproduced live: on the default confirmation view, type "Amina", then click "No answer" about 100 ms later. The URL becomes `?view=<no_answer>&q=Amina`, and the view opens already Modified.
- Same failure when you type and then press Reset (`saved-view-bar.tsx:79`) inside 300 ms. If the view has a saved `q`, clearing the box and pressing Reset writes `q=__cleared__`.
- Fix:
  - Keep the timer id in a ref.
  - When the URL changes from outside (view, Default or Reset), cancel the timer and take the URL value. To detect that: track the `view` param, or `sp` without `q`, in a ref; or remount the input with a `key` on the view plus a Reset counter.
  - Typing and then picking a status inside 300 ms must still merge both.

### 2. MEDIUM (regression): a slow echo of the user's own write snaps the box back and drops keystrokes
`src/components/fields/search-param-input.tsx:11-12, 39-41`. Affects every `SearchParamInput`, including contacts.
- Type "Ami" and pause about 350 ms, so `replace(q=Ami)` starts. Type "na" before the server page lands.
- When it lands, `fromUrl` becomes "Ami" and `syncedValue("Amina","Ami")` returns "Ami".
- The box is now equal to the URL, so the debounce effect starts no timer, and "na" is lost.
- Before round 3, an echo never changed the box.
- Fix: keep a ref with the last value this component wrote. If `fromUrl` equals it, ignore it (it is our own echo). Only adopt URL changes that came from outside (this ties in with the fix for #1).

### 3. LOW (CONF-1-F): a saved view with a terminal status opens empty on the actionable page
`confirmation/page.tsx:128`, `delivery/page.tsx:90`.
- `show=all` is not stored in the view config.
- A view saved on `show=all` with Cancelled or Returned shows no rows from the default page.
- Fix: lift the actionable restriction when the view's status is terminal (delivery keeps its fixed `confirmed` filter), or show a "needs Show closed" hint.

### 4. LOW (CONF-1-F): `syncedValue` compares trimmed text
`search-param-input.tsx:12`. Harmless in itself (a trailing space is kept). It goes away with the fix for #2.

## Verified OK
- Delivery status options by default: the 8 actionable statuses only; `swap` and terminal statuses are absent.
- Confirmation status options: `wait_for_confirmation`, `no_answer`, `closed_phone`, plus `cancelled` with `show=all`. The fixed page filters are unchanged.
- "Save as mine" is hidden on personal views and still shown on shared seeds.
- No overflow or clipping in AR RTL at 390 px.
- The touched unit tests pass (7/7).
- Not checked: EN and dark theme on round-3 screens (only AR was captured; both screenshots are light theme).

## Missing tests
- A jsdom component test with fake timers and a mocked `next/navigation`:
  - Type, then change `searchParams` to another view with no `q` before 300 ms. Assert `router.replace` is never called with the old text.
  - Same for Reset.
- A slow-echo test: the URL catching up to an older value must not overwrite newer typing.
- Delivery excludes `swap`, `returned` and `cancelled` by default. Confirmation never lists `confirmed`, even with `show=all`.
- "Save as mine" is hidden for non-shared views (`view-tabs.tsx:120`).
