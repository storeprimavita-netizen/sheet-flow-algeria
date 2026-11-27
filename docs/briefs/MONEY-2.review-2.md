VERDICT: FIX

## Summary
Recheck of review 1: findings 1-5, 8, 9, 12-15 are fixed; 6 is partly fixed.
The fix for 6 adds one medium money-write regression, found by both qa-reviewer and ui-reviewer.
Pure unit tests pass (32/32). Live RLS suite and gate.sh not run (shared database).
Reviewed the uncommitted working tree. No owner decision needed.

## Status of review-1 findings
| # | Status | Verified by |
|---|---|---|
| 1 | Fixed | app (AR 390 px, page width 390) |
| 2 | Fixed | code |
| 3 | Fixed | app |
| 4 | Fixed (narrower residuals below) | app |
| 5 | Fixed | app |
| 6 | Partly: "12,5" is 12.5, but see finding 1 | app + simulation |
| 8 | Fixed | code |
| 9 | Fixed | code, against view 00084 |
| 12 | Fixed | code |
| 13 | Fixed (equal amounts on one day still share a button name) | app |
| 14 | Fixed (see finding 3) | app |
| 15 | Fixed | app (AR 390 px) |

## Findings

### Medium
1. `src/components/fields/number-field.tsx:19-23` (`decimalInput`): typing "1,000,000" key by key leaves "1.000000", which is 1, with submit enabled; the first comma becomes a dot before the next one arrives. "1,000" also becomes 1, and pasting "25,000" gives 25. An admin can post 1 DA instead of 1,000,000 in quick-add, payout, transfer or legacy conversion. Other non-integer `NumberField` users (pricing, offers, calculator) share this. Fix: interpret the whole typed string instead of rewriting on each key, and treat a comma followed by three digits as grouping or reject it as invalid. Never turn it into a smaller valid number.

### Low
2. `src/components/finance/transfer-dialog.tsx:76-78`: an amount in with no matching 8-decimal rate (e.g. "100.555" DA) empties the rate, disables submit and hides the mismatch alert. Fix: keep the previous rate when `rateFromAmounts` returns null.
3. `src/app/(app)/app/money/accounts/page.tsx:189`: `key={account ?? "all"}` remounts quick-add on every filter change, losing the typed input and the retry key. After a lost response, re-entering the movement writes a second row. Fix: drop the `key`; update only the selected account.
4. `src/components/finance/transfer-dialog.tsx:119`: with amount out empty, editing the rate erases a typed amount in. Fix: keep it when there is no quote.
5. `src/components/finance/ledger-table.tsx:44,99`: after a successful reversal the opener button is gone, so focus falls to `body`. Fix: if the opener is disconnected, focus the ledger heading.

## Missing tests
- Unit: feed `decimalInput` one character at a time for "1,000,000" and "1,000.50"; the result must never be 1.
- Unit: request key survives dialog close and reopen with the same input, and changes when the input changes.
- Unit: transfer direction switch clears amounts; typing amount in first keeps the rate.
- Still open from review 1: live tests for transfer reversal, repeated transfer key, `postLegacy`/`remapLegacy`; `addExchangeRate` USDT and 1e8 limit.

## Not verified
- Live RLS suite (D24 needs it green before ship) and `scripts/gate.sh`.
- No form was submitted; legacy panel and category chip checked by code only.
- Not every theme, locale and width combination.

## Note on the shared database
ui-reviewer saw one ZR ledger row (+1 000.50 DA, 27/11/2026) that it says it did not create. Origin not checked; nothing was changed or removed.
