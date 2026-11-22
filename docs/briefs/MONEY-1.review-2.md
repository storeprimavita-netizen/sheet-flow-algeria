VERDICT: PASS
Reviewer model: claude-opus

## Summary

Rechecked review 1 against `cc4f9f1..8298f36` and the local schema. Both medium and all three low findings from that round are fixed. Three new low findings go to BACKLOG. The separate full build gate passed with 1,371 tests and live RLS.

## Findings

- **Fixed · review 1 #1.** The rate rule is shared across debit writes, ledger appends, balances and legacy preview. Legacy rows with the implicit rate remain pending.
- **Fixed · review 1 #2.** The generic reversal RPC rejects source-linked entries, preserving balance and source consistency.
- **Fixed · review 1 #3–5.** The balance view grants authenticated SELECT only. The remap exception checks evidence for the exact source and destination. Category seeding adds only missing labels and preserves archived choices.
- **Low · migrations 00083–00085.** The foreign rate check uses the fallback of 1 from `src/lib/fx.ts`. Store explicit rate provenance so validation can distinguish a recorded rate from a fallback.
- **Low · migration 00084.** The balance view omits unsupported dinar equivalents. Add an invariant test or expose the unresolved debit state.
- **Low · expense and ad-spend actions.** Translate the debit currency constraint error on forms.

## Missing tests

- A linked ad-spend entry is refused by the generic reversal RPC.
- Updating a valid foreign debit to an implicit rate is refused.
- A legacy remap with an existing direct ledger debit preserves the right entries and source balances.
