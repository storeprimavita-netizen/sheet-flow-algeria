VERDICT: ESCALATE
Reviewer model: claude-opus

## Summary

Design review against D19, D39, the existing Accounts action, schema and local database. The brief needs a live-write currency guard and a decision on how the owner can review and remap legacy accounts. The live RLS suite applies after implementation.

## Findings

1. **High · MONEY-1.md step 6.** Live expenses and ad spend can link an amount in DZD or USD to a USDT account. Validate the currency on both tables on insert and update. Allow a matching currency or the stored DZD equivalent for a DZD-denominated account.
2. **Medium · step 5.** Make request keys unique per workspace and serialize concurrent submissions. Generate the transfer identifier on the server.
3. **Medium · steps 4–5.** Define append-only reversals with a unique reference to the original entry. Reverse both legs of a transfer atomically.
4. **Medium · step 6.** Enforce one original ledger entry per linked debit source. Require matching workspace and account IDs.
5. **Medium · step 4.** Define foreign key deletion behavior that preserves append-only entries. Validate the category's option set and seed it for existing and new workspaces.
6. **Medium · steps 1–3.** A legacy crypto balance may be recorded in USD, which can stop a production migration after earlier migrations have applied. Add a preflight check for the owner. D39 also permits the owner to remap legacy accounts in the app. Define when and how that happens before implementing the import.
7. **Low · steps 2–4.** Use privileges to restrict structural mutations while preserving workspace cascade and service-role test cleanup. Explicitly revoke writes, including truncate, on retained legacy data and ledger entries.
8. **Low · step 5.** Constrain transfer directions and enforce FX consistency. Resolve how payouts before ZR-4 interact with the starting balance.
9. **Low · step 7.** Make a manual top-up retry safe. ZR-4 needs uniqueness on the source payout when that source exists.

## Missing tests

- Reject newly linked currency mismatches, direct agent RPC access, and mutation of legacy data.
- Verify independent workspace request keys, atomic single reversals, linked-source uniqueness, and delete restrictions.
- Verify workspace cleanup and exercise the preflight with a USD-denominated crypto fixture.
