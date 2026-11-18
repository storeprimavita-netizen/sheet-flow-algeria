VERDICT: FIX

## Summary
Reviewed the diff `git diff v3...v3-PRICE-1` with the qa-reviewer, because the task is risk high and touches money. Vitest passes 37/37 and tsc is clean.
The 8 cost lines, the exact and recommended price, profit, margin, all four break-evens and all 30 benz cells match PRICE.md and D50/D51.
All 8 findings from review 1 are fixed.
One medium finding is left: `target.mode` and `target.value` are merged as separate fields, so a mode can pick up a value meant for the other mode and produce a wrong but finite price.
No owner decision is needed, because the fix applies D51 as written.

## Findings (ranked)

### 1. MEDIUM: `target` is merged one field at a time, mixing modes (src/lib/pricing-v2.ts:152-172, used at :278-279)
`mergeNode` merges `target.mode` and `target.value` separately. The value means DZD in profit mode and a fraction in markup mode, so one settings level can supply the mode while another supplies the value.

**Failure 1.** Defaults are combined with the product override `{target:{mode:"markup", value:null}}`. This is what the user sends after switching to markup without typing a value yet.
- The value 1500 is inherited and read as a markup of 150000%.
- Target profit becomes about 2,720,000 and the recommended price **2,777,600 DZD**.

**Failure 2.** The workspace has `{mode:"markup", value:0.65}` and the product override has `{mode:"profit"}`.
- The 0.65 is read as DZD, so target profit is 0.65 DZD and the recommended price about 4,000.
- Neither result is null, so the UI would show a wrong price that looks real.

**Fix.** In `mergeSettings`, treat `target` as one unit:
- Take the override's target only when it has both a valid mode and a finite value.
- Otherwise keep the base target whole.
- If the mode changes and no value comes with it, make target profit null and let it flow down to the outputs.

**Tests to add.** Both failure cases above.

### 2. LOW: settings are only checked for being finite, not for range or sign (:162, :248-258)
**Failure: percent typed instead of a fraction.** With `share: 50`, the platform monthly line is 16,433 and the recommended price 22,100. A markup typed as 65 has the same problem.

**Failure: negative values pass.**
- `months: -2` with `platformPct: -0.5` gives k = -0.97 and a recommended price of 2,600.
- A negative multiplier, a negative ad cost or a negative stock cost is accepted and produces negative cost lines.

**Fix.**
- Require share and platformPct in [0,1).
- Require money fields and the multiplier to be ≥ 0.
- Return null when a value is out of range.
- At minimum, write these ranges into the PRICE-2 zod schema.

### 3. LOW: a negative target profit gives a negative or -0 recommended price (:208, :286)
**Failure.** In profit mode, a target of -5000 gives a recommended price of -1,100, and the best and worst columns then use P = -1,100. Separately, `Math.ceil(-0.5)*100` returns `-0`, which can display as "-0".

**Fix.** Require target value ≥ 0, or return null when the exact price is ≤ 0.

### 4. LOW: risks to handle in PRICE-2 and PRICE-3
- Calling `computeScenario` without `defaultPrice` uses the scenario's own recommended price. The PRICE-3 Real column must pass the medium recommended price.
- `PricingProduct.adCostUsd.medium` is typed `number`, but the PRICE-2 column is nullable. Type it `number | null`.
- A typed best or worst ad cost of 0 counts as typed. PRICE-2 must send null for an empty field, never `Number("")`.

### Accepted, not a bug
up100 rounds to cents before `ceil`, so it can land up to 0.005 DZD below the exact price (5400.004 gives 5400). The brief intends this.

## Missing tests
- The two target-merge cases from finding 1.
- `minDelivery` returning null when its denominator is ≤ 0. The current test only reaches the ">100%" branch.
- The worst column's `finalPrice` when the final price is empty. Only the best column is asserted, at test.ts:72.
- Negative or out-of-range settings: share, platformPct, months, multiplier, ad cost and target.
- `up100` with a zero or negative exact price, to catch `-0`.
