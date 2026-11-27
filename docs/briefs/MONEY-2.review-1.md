VERDICT: FIX

## Summary
qa-reviewer: PASS (no high or medium; 3 low; 28/28 pure unit tests pass). ui-reviewer: FIX (1 high, 5 medium).
Blocking: 390 px RTL overflow, unsigned legacy preview, transfer field handling, focus return, comma amounts.
Live RLS suite and gate.sh not run (shared database); D24 needs the live suite green before ship.
Reviewed the uncommitted working tree (`git diff v3` plus untracked files). No owner decision needed.

## Findings

Files without a path are in `src/components/finance/`.

### High
1. `ledger-table.tsx:46,55`: at 390 px AR the page scrolls sideways (611 px) and exposes the off-canvas sidebar, because the `sr-only` header escapes the scroll box. Fix: `relative` on the wrapper (reviewer verified width 390).

### Medium
2. `legacy-mapping.tsx:96`: preview ignores `direction`, so money in and money out both read "Movement 150.00 USD" before "Post all". An admin cannot check what will be posted. Fix: show a sign or In/Out.
3. `transfer-dialog.tsx:100`: switching direction keeps amount out; 1,000,000 DA became 1,000,000 USDT (250,000,000 DA) with submit enabled. Fix: clear the amounts on switch.
4. `transfer-dialog.tsx:71-72`: typing amount in before amount out erases the rate, and submit disables with no reason. Fix: keep the rate.
5. `account-cards.tsx:86`, `ledger-table.tsx:91`: Escape on the Edit or Reverse dialog drops focus to `body`. Fix: restore focus to the opener.
6. `src/components/fields/number-field.tsx:79` (code reading, not reproduced): commas are stripped, so "12,5" becomes 125 in money fields. Fix: treat a comma as the decimal mark.

### Low
7. `src/lib/option-sets-actions.ts:154`, `src/lib/option-sets.ts:95`: `money_category` now offers merge and delete, but `repointReferences` ignores `account_entries.category_id`. Merging a used category fails with a raw FK error, and the usage count can be capped by PostgREST's row limit (no data loss). Fix: count per option with `head: true`; refuse merge with a translated message.
8. `transfer-dialog.tsx:41`: the request key is lost when the dialog closes. If the response is lost after commit, reopening and resubmitting writes a second transfer. Fix: hold `useLedgerSubmit` above the dialog content or keep the failed key.
9. `src/app/(app)/app/money/accounts/page.tsx:150-153`: for a pending legacy account, a foreign-currency expense shows in its own currency, but view 00084 subtracts the raw amount from the account's currency. Fix: for accounts with no kind, show the amount in the account's currency.
10. `number-field.tsx:83` (`src/components/fields/`): "USDT" touches the digits; widen the padding. Money inputs lack group separators.
11. `ledger-table.tsx:62-69`, `accounts/page.tsx:152`: Expense / Ad spend chips are not links; charge links open the unfiltered list.
12. `accounts/page.tsx:142`: category is plain text, without Chip, colour or emoji.
13. `ledger-table.tsx:52,62,79`: Amount header misaligned; account name not in `<bdi>`; every button is named only "Reverse".
14. `ledger-quick-add.tsx:27`: ignores `?account=`, so it defaults to ZR while viewing USDT.
15. `src/app/(app)/app/settings/exchange-rates-section.tsx:28`: three columns at 390 px wrap "USD → DZD" awkwardly in AR.
16. `src/messages/{en,ar}.json`: the subtitle does not say what to do; the AR rate line uses "دج" while amounts use "DA".

## Missing tests
- Live: reversing one transfer leg reverses both and restores both balances; a second reversal is refused.
- Live: `transferFunds` repeated with the same key leaves balances unchanged.
- Live: `postLegacy` and `remapLegacy` through the actions, including a stale mapping id.
- Unit: `addExchangeRate` accepts USDT and rejects rates of 1e8 or more.
- UI: transfer field interplay, focus return, 390 px RTL overflow with ledger rows.

## Not verified
- Live RLS suite (`accounts.rls.test.ts`, including the new payload test) and `scripts/gate.sh`.
- Real populated ledger, totals, pagination, charges list, legacy preview and payout dialog (no data, ZR is 0). Screenshots of rows used fake client-side data.
- Any submit, toast, retry or double click; action-level agent refusal in the running app; loading and error states (code only).
- Not every theme, locale and width combination; contrast not measured.

Screenshots: `docs/design/audit/MONEY-2/`.
