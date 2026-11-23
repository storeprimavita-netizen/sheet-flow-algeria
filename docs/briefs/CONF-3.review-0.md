VERDICT: FIX
Reviewer model: claude-opus

## Summary

The design preserves caller scope and keeps lifetime value admin-only. An unlinked order needs a distinct customer-link state so missing aggregated data cannot be shown as favorable history.

## Findings

1. **Medium · brief customer lookup.** Use a separate unlinked state when the source order cannot be matched to a customer record, even if the phone matches other visible orders. Keep it distinct from new, unscored and zero risk.
2. **Low · role gate.** Missing and inactive roles must fail explicitly before looking up the order.
3. **Low · phone match.** Require the accepted normalized phone shape before matching. Placeholder and short numbers should return no related entries.
4. **Low · client cache.** Keep fetched cards in component-local state, scoped to the current user and order, and clear the cached result on identity changes.
5. **Low · query cost.** Check the delivery-cohort lookup plan alongside the normalized-phone lookup. Preserve bounded results and avoid unnecessary cohort calls.
6. **Low · copy.** For agents, explain that available delivery and score history reflects visible orders.

## Acceptance additions

- Test unlinked order plus matching legacy rows, placeholder phone, inactive users, and `has_more` based only on visible rows.
- Verify scope change invalidates local cached data and inspect both SQL lookup plans. Run full live RLS gate under D24.
