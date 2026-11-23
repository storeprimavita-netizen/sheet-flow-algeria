VERDICT: FIX
Reviewer model: claude-opus and codex ui-reviewer

## Summary

The defensive review confirmed scoped role checks, canonical phone matching and admin-only lifetime value. Independent browser checks confirmed agent and admin display, Escape focus restoration and hover. One medium finding remains in link-state accuracy.

## Findings

1. **Medium · `00089_confirmation_customer_score.sql:30`, `customer-score-card.tsx`.** An order with a saved customer reference whose record cannot be resolved displays the same text as one with no reference. Carry an explicit unresolved state through the DTO and translate separate text in EN and AR. Test the defensive state while preserving workspace scope.
2. **Low · `00089_confirmation_customer_score.sql:67`.** Descending nullable order dates can put undated rows before recent ones. Sort null dates last and keep the index order consistent.
3. **Low · `confirmation/page.tsx:89`.** A row marked unlinked may still resolve customer history in the phone-based card. Clarify that the row indicates the absence of a saved link.
4. **Low · customer score queries.** Opening each linked card computes the existing delivery cohort. Document the cost or consider a bounded cache keyed by user scope and customer.
5. **Low · score card placement.** At 390 px near the viewport bottom, the card shows roughly 140–185 px of internally scrollable height even with more space above the trigger.

## Coverage gaps

- Add unresolved-link, undated-related-order, mature-delivery-history and pending-response-after-remount coverage where practical.
- Independent UI review covered representative English and Arabic states in both themes, table and Kanban. It omitted the full matrix, physical-device touch, loading and retry, and the other-order link. The separate full build gate passed with 1,413 tests and live RLS.
