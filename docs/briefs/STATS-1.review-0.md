VERDICT: ESCALATE
Reviewer model: claude-opus

## Summary

Caller-scoped history preserves RLS. Because confirmation agents see different subsets of a customer's orders by status and assignment, the score can differ materially from the admin score. The brief needs a decision on what the score represents to agents.

## Findings

1. **High · STATS-1.md history contract.** An agent's score can be skewed by partial visibility. Keep the data explicitly scoped to visible history and prevent future UI from representing it as workspace-wide, or ask the owner to approve a narrowly scoped wider aggregate. The latter changes what the role may see.
2. **Medium · `00006_analytics.sql` settings join.** Existing settings RLS makes agents use default weights while admins can use configured weights. Specify and test whether the role keeps its defaults or is authorized to use the configured weights through a narrow interface.
3. **Medium · STATS-1.md step 2.** Do not run the whole-workspace KPI order-set scan per customer. Group the cohort once and check the filtered plans. Consider a separate details view if customer list reads would otherwise pay for the extra calculations.
4. **Low · score fields.** Handle malformed and negative stored weights, distinguish zero weighted contributions, and define how rounded scores relate to reasons.
5. **Low · view grants.** Explicitly reset authenticated privileges to SELECT only on both views.
6. **Low · field contract.** Document status type, future filter-band mapping, delivery maturity and the distinction between risk counts and KPI cohort eligibility.

## Missing tests

- Cover admin and agent readings of the same partial history, configured and zero weights, and any role authorized for delivery data.
- Verify non-numeric settings, SELECT-only grants, replacement visibility and query plans for single and batched lookups.
