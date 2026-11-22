VERDICT: FIX
Reviewer model: claude-opus

## Summary

The implementation resolves the core design findings. Two medium issues remain in how foreign debits reach dinar balances and how linked debits can be reversed. The review inspected the local migration state. Build evidence includes a separate full gate with live RLS.

## Findings

1. **Medium · `00084_account_balance_guards.sql:53`, `00085_legacy_account_mapping.sql:68`.** The positive FX-rate check accepts the existing default rate of 1 for foreign debits. That can silently add a nominal foreign amount to a dinar balance or treat it as confirmed during legacy posting. Require a supported DZD equivalent and use the same rule in the live write guards, balance view, append RPC and legacy mapping. Preserve unresolved legacy rows under D97.
2. **Medium · `00083_account_entry_rpc.sql:228`, `00084_account_balance_guards.sql:26`, `00085_legacy_account_mapping.sql:55`.** Reversing a source-linked debit cancels the ledger movement while the source stays suppressed from the balance and locked against edits. Either keep source-linked debits out of generic reversals or implement consistent active-posting semantics in balances, guards, remapping and uniqueness.
3. **Low · migration 00084 account balances grants.** Limit authenticated view privileges to SELECT explicitly.
4. **Low · migration 00084 debit guard.** The scope of the legacy remap exception relies on the broad `postgres` execution identity. Narrow it to the trusted remapping operation.
5. **Low · migration 00081 category seeding.** Safely add missing defaults to pre-existing money category sets as well as newly created sets.

## Missing tests

- Foreign debit with an implicit rate on a DZD-denominated account, including legacy preview and posting.
- Source-linked debit reversal and its effects on the balance, source editability and remapping.
- Sequential legacy remaps and cleanup of a workspace with linked entries and reversal chains.
- Authenticated write attempts through the balances view are denied.
