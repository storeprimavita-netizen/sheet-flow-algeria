# MONEY — two accounts, DZD and USDT

Owner: "I want to track our finance with DZD and USDT, two accounts, no more;
users input the logs manually." (D19)

## Model

The existing `accounts` / `account_topups` (migration 00017, "spending budget
accounts") become a real two-account ledger:

- Exactly **two system accounts per workspace**: `DZD` (cash/bank in dinars)
  and `USDT`. `accounts.kind` (`dzd|usdt`) with a unique (workspace_id, kind)
  constraint; creating a third is impossible, not just hidden. Currency enum
  gains `USDT`.
- `account_entries` (append-only ledger): account_id, occurred_on, direction
  `in|out`, amount (in the account's currency), category (option set
  `money_category`, emoji allowed: stock purchase, ads top-up, salary,
  courier payout, owner withdrawal, transfer, other), note, optional links
  (expense_id, ad_spend_id, supplier contact, courier payment), created_by.
  A correction is a reversing entry, never an edit or delete (audited).
- **Transfer** between the two = one action writing both legs with the rate
  used (DZD per USDT), linked by `transfer_id`.
- Balance = opening balance + Σ in − Σ out (view `account_balances`, kept).
  Totals in DZD value USDT at the latest manual `exchange_rates` row for USDT;
  the rate and its date are shown next to any converted number.

## Existing data

`accounts` rows that exist today are mapped by currency: DZD-currency rows fold
into the DZD account, USD rows into USDT — **only with the owner's go-ahead**
(owner input M-1: list the current accounts and say where each goes). Existing
`expenses.account_id` / `ad_spend_daily.account_id` links are re-pointed; no
row is deleted.

## Screens (Money → Accounts)

- Two cards: balance, last entry, low-balance threshold banner (kept).
- One ledger table with an account filter; quick-add row at the top (date,
  in/out, amount, category, note) — the whole point is fast manual logging.
- "Transfer" button (amount out, rate, amount in computed and editable).
- Recording an expense or ad spend elsewhere may tick "paid from: DZD | USDT",
  which writes the ledger entry through the same component — nothing is
  typed twice (interconnection rule 5).
- Monthly statement export (CSV).

## Rules

- Admin-only tables and screens, as all financial data (AGENTS.md). "Users
  input the logs" = admins. If a non-admin bookkeeper is ever needed, that is
  a new role and a new decision — not a relaxed policy.
- The ledger is cash movement; it does not replace `pnl_summary` (profit).
  Money → Overview keeps showing profit; Accounts shows where the cash is.
- No automatic entries from order events in v1: courier payouts are logged by
  hand (or linked to a ZR payment once ZR-4 exists).

## Tasks

MONEY-1 migration (kind, USDT, `account_entries`, constraints, RLS, audit) +
data mapping after M-1 (lane db, risk high) · MONEY-2 Accounts screen with
quick-add and transfer · MONEY-3 "paid from" on expense / ad-spend forms +
statement export.

## Acceptance

Third account insert fails at the DB · transfer writes two entries with one
`transfer_id` and the balances move by the right amounts · an agent session
reads zero rows from `accounts` and `account_entries` · entries cannot be
updated or deleted, only reversed.
