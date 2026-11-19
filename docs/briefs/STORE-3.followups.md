# STORE-3 follow-ups (after review 2)

Done in R2: findings 1-3, 6 (deleted bump product no longer blocks offer save).

Screens (finding 4): added store light + OS-dark at 1280 (AR RTL default, size picker, 2 offers, "orders open soon"):
`docs/design/audit/STORE-3/store-light-1280.png`, `store-osdark-1280.png`. The store honours
`prefers-color-scheme: dark` via `theme.css:82` (by design of theme.css; brief says light default) - owner to confirm.
Still not captured: Selling AR/light, per_value/per_variant modes, no-sizes switch, error/skeleton, 0 offers, 1 size, all out of stock, preview validation error.

Open lows, to do before/with STORE-4: 5 (mixed-size offer rule), 7 (atomic offer save + stable ids; must precede STORE-4), 8 (savePricing finally-invalidate),
9 (integerInput "2500,00" - existing test pins "2500.00"->"2500"), 10, 11, 12, 13, 14, 15, 16.
Missing tests listed in review-2 remain.
