VERDICT: PASS

## Summary
Recheck of review 2: all 5 findings are fixed. No high or medium regression.
Two low regressions come from the fixes (below).
Pure unit tests pass (33/33). Live RLS suite and gate.sh not run (shared database).
Reviewed the uncommitted working tree; nothing committed. D24 still needs the live suite green before ship.

## Status of review-2 findings
| # | Status | Verified by |
|---|---|---|
| 1 | Fixed: "1,000,000" ends at 1000000; "25,000" is rejected | app (character-by-character input) + simulation |
| 2 | Fixed: rate is kept, mismatch alert shows, submit disabled | app |
| 3 | Fixed: input survives filter changes (but see finding 1) | app; retry key by code |
| 4 | Fixed | app |
| 5 | Fixed | code only (a reversal would write) |

## Findings

### Low
1. `src/components/finance/ledger-quick-add.tsx:39-43`: a filter click moves a half-typed entry to another account. Type 1000 with DZD selected, click the USDT filter: the amount stays, the unit changes, and submit posts 1000 USDT. The account field and unit do change on screen. Fix: follow the filter only while `amount === null`, or clear the amount when the currency changes.
2. `src/app/(app)/app/catalog/products/[id]/stock/count-by-size.tsx:27,65` (uses the changed `NumberField`, not `integer`): "1,000" now reads as invalid and becomes null. With other sizes filled, submit saves those, silently skips this one and empties every field. Before the fix it counted 1000. Fix: add `integer` to that field. Code only.

## Missing tests
- Unit: the `decimalInput` test feeds whole strings only, despite its "key by key" comment.
- Unit: request key survives dialog close and reopen, and changes when the input changes.
- Unit: transfer direction switch clears amounts; amount in typed first keeps the rate.
- Live: transfer reversal, repeated transfer key, `postLegacy`/`remapLegacy`; `addExchangeRate` USDT and 1e8 limit.

## Not verified
- Live RLS suite (including the new test in `accounts.rls.test.ts`) and `scripts/gate.sh`.
- No form was submitted: successful reversal, retry after a lost response, server handling of posted values.
- Legacy conversion and Settings rate fields in the app; real clipboard paste; Arabic, light theme, 1280 px.

## Note
A rejected amount such as "25,000" shows a red border and a disabled button, with no text saying why.
