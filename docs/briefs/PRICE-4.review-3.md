VERDICT: ESCALATE

## Summary
Round 3 (n = 3, no PASS yet), so the rule says ESCALATE. One high finding is still open.
`toCSV` does not quote a `;` or a tab inside a value. Excel opens `.csv` files with the system list separator, which is `;` on fr-DZ and ar-DZ machines. Customer-controlled text such as `Ali;=cmd|...` therefore splits into a bare formula cell in the orders export.
UI at 390px (L5/L6) checks out: tap targets are 44px, the fifth card spans both columns, there is no horizontal overflow, and RTL is correct. Only low findings remain there.
Portfolio math matches the brief and D68: capital = stock + ads, excluded rows are counted but kept out of every sum, and margin is null when revenue is 0.

## Findings

### HIGH — formula injection through the `;` / tab separator
- **Where:** `src/lib/csv.ts:20`. Fields are quoted only when they contain `" , \n \r` or have a leading/trailing space. The formula check on line 18 looks only at the start of the whole value.
- **Exploit:** a customer submits the name `Ali;=cmd|' /C calc'!A0` through the store form or the webhook. `customer.name` accepts any string (`src/lib/webhook.ts:40`, `:256`). The orders export (`src/app/(app)/app/orders/all/orders-all-table.tsx:102`) writes that value unquoted. Excel on a `;`-separator locale puts `=cmd|...` in its own cell (a DDE/formula payload). `Ali\t=1+1` does the same when the file is opened as tab-separated.
- **Fix:** quote any field that contains `;` or a tab: `/[",;\t\n\r]|^\s|\s$/`. Inside quotes the separator is literal, so the cell stays `Ali;=...` as text.
- **Test:** add `toCSV` cases for `Ali;=1+1` and `Ali\t=1+1` (both must come out quoted).

### LOW
1. `csv.ts:18`: full-width lookalikes are handled inconsistently. Only U+FF1D is covered; `＋ － ＠ ﹦` pass through. Excel does not evaluate these from a CSV. Either add all of them or drop the special case.
2. Phone numbers: the code leaves them intact, but Excel turns `0555123456` into 555123456 and `+213555123456` into `2.13556E+11` when it opens the file. Consider a per-column text option for phones in the orders export (owner/UX call, not a blocker).
3. `pricing-portfolio.ts` CSV vs the table:
   - `margin` is exported as a fraction (0.25) under a "Margin" header, while the table shows 25.0%.
   - `minPrice` is exported raw (3884.2), while the table shows the ceiling (3,885).
   - Float noise is possible.
   Rename the header or export percent, and round to 2 decimals.
4. `csv.ts:18`: a formatted negative passed as a string (`-1 500,50`) gets a `'` prefix. No current caller does this.
5. `portfolio-view.tsx:147`: product-name links are about 20px tall at 390px, under the 44px tap target. Add `py-2` or `max-sm:min-h-11`.
6. `portfolio-view.tsx:117-118`: the 13-column table scrolls sideways with no cue. At 1280 the Net profit and Margin totals are clipped at the card edge. Add an edge fade or a scroll shadow.
7. `portfolio-view.tsx:156-160`: the below-break-even chip makes its rows about 60px tall versus 37px for the rest. Cosmetic: use a compact icon chip with an aria-label.
8. `portfolio-view.tsx:106`: at 390px the fifth card has no hint line, and cards 1 and 3 have stretched empty space. Cosmetic.

## Missing tests
- `;` and tab inside a value (must be quoted).
- Full-width `＋ － ＠`.
- A leading `\n=` and a leading ` =` (both work today but are untested).
- Negative amounts as strings (`"-1500"`, `"-0.5"`) stay unchanged.
- `"-1500\n=1"` gets the prefix and quotes.
- `NaN` and `Infinity` output.
- An orders-export column test with a hostile `customer_name` and both phone formats.

## Not covered
The reviewer did not open the loading skeleton or the error state, and did not force the empty state (that needs writes). 1280px was checked only in EN dark. Excel behaviour comes from known behaviour and was not observed.

## Owner decision
This is round 3 without a PASS. Choose one:
- (a) authorise a 4th round for the one-line quoting fix plus its tests, or
- (b) accept the `;` gap. Note that it predates this branch and also affects the orders export.

Screenshots: `docs/design/audit/PRICE-4/rv3-*.png`.
