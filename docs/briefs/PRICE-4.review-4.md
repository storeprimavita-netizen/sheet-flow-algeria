VERDICT: PASS

## Summary
Round 4 (diff `56852fc..v3-PRICE-4`), reviewed by qa-reviewer against the review-3 HIGH finding and D69 using the owasp-security rubric. The segment rule is in place and all 19 pinned outputs in D69 (4) match exactly; the orders-style whole-row test passes. Since review 3 only `csv.ts`, `csv.test.ts`, DECISIONS and QUESTIONS changed, and the test file only gains lines. 300k fuzzed orders rows were re-read with comma, `;`, tab and paste readers: no cell starts with `=`, `@`, `＝` or a non-numeric `+`/`-`. Real phones and negative amounts are untouched. Gate green (680 passed, 3 skipped). Only lows remain; they go to PRICE-4-F.

Note: the PROGRESS note for round 4 was not yet on the branch when this review ran. Ship adds it.

## Findings

**LOW 1: the number-like exemption is judged per segment, but a cell in a foreign reader runs past the segment.** `src/lib/csv.ts:24`
- Failure: in a `;` reader, name `Ali;+1 ` followed by phone `,x` gives the cell `+1 ",",x",…`. In a comma reader, `-1500<LF>=1` gives the cell `-1500<LF>'=1`.
- Either way the cell is a number literal followed by `"` or `'`, which is a formula syntax error, so it should be imported as text. This is not proven against Excel.
- `customer.phone` is free text (`src/lib/webhook.ts:41`), so two neighbouring columns are customer-controlled.
- Fix: exempt only segments that end at a separator. This contradicts the D69 pins `0555123456;+213555123456` and `-1500<LF>=1`, so it is an owner/PRICE-4-F item and does not block.

**LOW 2: U+2028 and U+0085 are left bare and unquoted.** `src/lib/csv.ts:20`
- Failure: `x<U+2028>=1` comes out unchanged. No known spreadsheet splits rows on these characters, and D69 (3a) fixes the separator set at `;`, tab, CR and LF.
- Fix (optional, PRICE-4-F): add both characters to the quote trigger.

D69 (6) accepted limits were not counted as findings.

## Missing tests (to PRICE-4-F)
- CRLF inside a value (`Ali\r\n=1`) and a lone CR (`Ali\r=1`).
- A value starting with `;` (`;=1` → `";'=1"`), and `\r=1` keeping its leading apostrophe.
- Whitespace other than a space after a separator (`Ali;\t=1`, NBSP).
- A number-like second segment that is not a phone (`Ali;-1500` stays bare).
- Output for null, undefined, NaN and Infinity.
- A test that runs the real `exportRows` columns from `orders-all-table.tsx`.
