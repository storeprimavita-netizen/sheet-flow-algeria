# Decisions (launch push, 2026-10-21)

| # | Decision | Why / rejected alternatives |
|---|---|---|
| D1 | Workflow = existing analyse/execute conventions; Verify (independent agent review) and Ship (build+test+secret scan+push) are inline steps. No new skill files. | Repo only has bootstrap/analyse/execute (Phase-14-specific). Owner approved. |
| D2 | Scrubbed `kimi.tx` + debug zip from the 104 unpushed commits (filter-repo, backup tag + bundle). origin untouched. | Alternatives: separate clone, or skip GitHub. Owner approved local rewrite. |
| D3 | Charts stay hand-rolled server SVG/CSS. No chart library. | Council C/D: none installed, d3-geo only; bundle weight. |
| D4 | One KPI contract computed in SQL (`kpi_lines`), returning numerator/denominator/matured flag; `pricing.ts` keeps margin/break-even only. Definitions in `docs/council/B-kpi.md`. | B: rates duplicated in 5 places, cohort mismatches. Rejected: patching each site. |
| D5 | ROI = net_profit / total_costs. ROAS stays separate and labelled. | Prompt §4. |
| D6 | Lightfunnels stays as an inert incoming integration (enum kept). MNW product pages become the native channel and must not depend on it. | E: removal buys nothing, enum can't be dropped, history uses it. |
| D7 | Meta Ads = P2, built against mocked Graph fixtures; real sync blocked on owner credentials. Facts from third-party blogs must be verified against Meta docs first. | E. |
| D8 | **OPEN (owner)**: Council D flags `transition_order_status` lets any agent role change any order (no stage-bucket check) and F flags agents read `sale_price/qty/fees` on all orders. Both come from migration 00015 / Phase 14a "free transitions, agents see all orders", an earlier deliberate decision. Not changing without confirmation. Cheap middle path: keep free transitions, restrict agent column UPDATEs (name/phone/address/assignment) and document price visibility as accepted (agents quote COD totals). | Contradicts SPEC §2 intent if read strictly. |
