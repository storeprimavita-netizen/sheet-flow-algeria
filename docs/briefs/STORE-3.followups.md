# STORE-3 follow-ups (after round 4, D61)

Fixed in round 4: review-3 #1 (unit null -> 404), #3 (public offers titled "Quantity offers"), #4 (pricing save always sends every delta, 0 outside per_value), #5 (offer rule documented in offer-price.ts, mixed-size test).

Open, STORE-4 brief starts from this list:
- First step of STORE-4: review-3 #7 + #8 together: offers and pricing each saved by one DB function in one transaction, stable offer ids, store cache always refreshed. Before any order stores an offer id.
- #6: integerInput("2500,00") -> 250000 (wider fix than split on comma: the field cleans on each keystroke).
- #9: "save X" label must follow the chosen size.
- #10: related cards in one batch of queries.
- #11: app chrome targets under 44 px in the 390 preview.
- Missing tests: selling actions call updateTag('store-public'); sale price above compare price saved through the product action; live test that save per_value then uniform leaves price_delta rows at 0.
- Screens (D61 #5): not captured by the builder (no browser run in this round); left to the ui-reviewer, files `docs/design/audit/STORE-3/r4-*`.
