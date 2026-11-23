VERDICT: FIX
Reviewer model: claude-opus

## Summary

Callback validation needs to preserve existing confirmation transitions and enforce callback writes consistently across role and insert paths. Define eligibility before the database build. The reviewer inspected the live local schema and ran no implementation tests.

## Findings

1. **High · brief step 1.** Clearing the callback before `orders_guard_fields` runs can cause legitimate agent transitions to fail. Ensure clearing runs after the guard or inside it after the guarded comparison. Keep the callback field outside generic agent write permissions.
2. **Medium · brief step 1.** The existing guard returns early for admin and service sessions and does not cover inserts. Enforce the callback write contract across inserts and updates and add a status constraint. Verify admin HTTP writes as well as the action path.
3. **Medium · eligibility.** Specify actionable queue statuses and both pre-handoff checks. Exclude confirmed orders from Due so the separate shipment insert path cannot leave them eligible. Apply eligibility to the read and write contracts.
4. **Low · callback inputs.** Explicit clearing uses null while a missing value is rejected. Specify timestamp validation in both Zod and SQL.
5. **Low · Today confirmed.** Use one scoped history existence query before pagination. Avoid loading IDs and passing them back through a list filter.
6. **Low · actor and assignment.** Project only profile display names and document that callback edits follow current queue scope, including callbacks on other agents' visible orders.

## Acceptance additions

- Test agent confirm and cancel with an existing callback on both transition signatures. An eligible no-answer to closed-phone transition retains the callback.
- Test omitted versus explicit-null RPC input, direct ineligible writes, handoff, Algiers late-evening times and Today confirmed exclusions for orders created already confirmed.
