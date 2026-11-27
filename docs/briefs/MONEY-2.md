# MONEY-2 — Accounts screen: ZR, DZD, USDT

risk: high · surface: ui,security · lane: money
(Plan row says L; raised because the screen writes money. No migration: if one seems needed, stop and report.)

Goal: an admin sees the three balances, logs movements, transfers, marks ZR payouts taken, corrects by reversal and maps old accounts, using the MONEY-1 RPCs only.

## Done when
- Three cards (ZR, DZD, USDT): balance in own currency (DZD 2 dp, USDT up to 6), last movement date, low banner. DZD total values USDT at the latest `exchange_rates` USDT row (order of `current_fx_rate`) and shows rate + date; no rate → no total, link to Settings.
- Admin can enter a USDT rate in Settings → Exchange rates.
- Quick-add (account, date, in/out, amount, category, note) writes one `append_account_entry`; a retry or double click writes no second row.
- Ledger: newest first, `?account=` filter, `?page=` of 50. Reverse behind a Radix Dialog.
- Transfer DZD↔USDT (amount out, rate, amount in computed and editable). "Mark ZR payout taken" moves ZR → DZD, amount prefilled with the ZR balance, editable; disabled with a visible reason when balance ≤ 0.
- Legacy accounts (D97): preview, post all, remap, conversion amount + evidence per source.
- No create-account, opening-balance or currency inputs remain; name, threshold, active stay editable.
- Loading / empty / error / populated; EN + AR; both themes; 390 px. Agent is refused by page and every action.

## Files
- `src/lib/ledger.ts` + `.test.ts` (new, pure): transfer pair without float drift, satisfying the DB check `round(usdt*rate,2) = dzd` (rate ≤ 8 dp, USDT ≤ 6 dp; editing amount-in recomputes the rate); DZD total; `needsConversion(source, kind)` mirroring `legacy_mapping_plan` (00085); `canReverse(entry)`.
- `src/lib/format.ts`: `formatAccountAmount(value, currency)`; reuse in Money → Overview (its `money()` rounds USDT to whole units).
- `money/accounts/actions.ts`: `saveEntry` (replaces `saveTopup`), `transferFunds`, `markPayoutTaken`, `reverseEntry`, `postLegacy`, `remapLegacy`. Each: `requireAdminProfile`, zod, session client, translated error, revalidate accounts + overview. `saveAccount` unchanged.
- `money/accounts/page.tsx`, new `loading.tsx`, `error.tsx`; reads: accounts, `account_balances`, `account_entries`, unlinked expense/ad-spend charges, USDT rate, categories, `preview_legacy_accounts` (zod-parse the Json).
- `src/components/finance/`: new `account-cards`, `ledger-quick-add`, `ledger-table`, `transfer-dialog` (also payout), `legacy-mapping`; delete `account-table.tsx`, `topup-form.tsx`; trim `account-form.tsx` (raw inputs → field components).
- `settings/actions.ts` (`exchangeRateSchema`), `settings/exchange-rates-section.tsx`, `settings/page.tsx` (`current`): add USDT.
- `lib/option-sets.ts`: add `money_category` to `OPTION_SET_KEYS`; add its heading `settings.options.sets.money_category` (missing EN and AR).
- `money/overview/page.tsx`: threshold 0 = no low warning (also cards). `src/messages/{en,ar}.json`.

## Steps (commit + push each)
1. `ledger.ts`, formatter, tests. 2. Actions + tests. 3. Cards, quick-add, ledger, states. 4. Transfer, payout, reversal. 5. Legacy mapping. 6. USDT rate, categories, overview. 7. Screenshots + PROGRESS note.

## Acceptance tests
- `ledger.test.ts`: "transfer pair satisfies the DB rate check both directions", "editing amount in recomputes the rate", "total is null without a USDT rate", "needsConversion matches the SQL rule", "linked, legacy and reversal rows cannot be reversed".
- `money/accounts/actions.test.ts`: "agent is refused by every action", "invalid input never calls the RPC", "same request key is passed on retry", "payout is ZR to DZD, equal amounts, no rate".
- Live: `accounts.rls.test.ts` stays green; add "actions' RPC payloads move balances by the exact amounts" (D24).
- Screens: Accounts (populated, empty, transfer dialog, legacy panel, 390 px), Settings rates; dark + light, EN + AR.

## Edge cases and checks
- `account_balances` also deducts expenses/ad spend that have no ledger row: list them read-only below the ledger (same compatibility rule as view 00084), else balances look unexplained.
- Reverse is hidden for source-linked, legacy-mapped, reversal and already reversed rows; a transfer reverses both legs.
- Request key: client UUID kept while input is unchanged, new after success or edit; transfer and reversal require one.
- `MoneyField` shows no decimals at ≥ 100 after blur: use `NumberField` for ledger amounts.
- Default dates are Algiers days (D46), not UTC `toISOString`.
- Pending legacy accounts stay listed with old balances; quick-add allowed in their currency, transfers not.
- Posting is all-or-nothing; `invalid_links` or `direct_debit_posting` blocks with a stated reason; a conversion sent for a source that needs none is rejected; null proposed kind must be chosen; stale mapping id → ask to reload.
- Confirmed: MONEY-1 RPCs, grants and admin RLS exist; ZR may go negative before ZR-4 (D97). Stale: the spec's "two cards" (D39: three).
- Out of scope: "paid from" on forms and CSV export (MONEY-3). No new DECISIONS row needed.
