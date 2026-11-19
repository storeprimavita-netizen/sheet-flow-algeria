# MNW master plan v3 (2026-11-17)

Scope grew from "COD ERP" to "COD platform": back office + native store +
tracking + AI connector. Specs: `docs/specs/` (index in its README). Decisions:
`docs/DECISIONS.md` (D15+ are v3). Loop: `.claude/loop.md`. Integration branch
`v3`; every step is committed and pushed.

**How to read a row.** Status: `todo` · `claimed:<agent>` · `done` ·
`blocked:<owner input id>`. Risk `H` = RLS/auth/migration/money/webhook/carrier/
public form/tokens/MCP (needs `qa-reviewer`; and the live RLS suite whenever it
touches the database, policies, auth or a server data path — D24).
Surface: `ui` → `ui-reviewer`; `sec` → security review. `M` = has a migration
(only one `M` task is built at a time). Lane = area; tasks in different lanes
may run in parallel. Pick the first `todo` row, top to bottom, whose deps are
`done` and whose owner input (if any) is closed.

## Owner inputs (close these to unblock rows)

| ID | What the owner provides or does | Blocks | Status |
|---|---|---|---|
| O-1 | This Mac: start Docker (colima) + `npx supabase start`, create `.env.local`; so the RLS suite and the app run locally | every `H` or `ui` task | closed (2026-11-17: stack up, seeded, 133/133 tests with live RLS) |
| O-2 | Back up Supabase, `npx supabase db push` 00020–00027, regen types, rotate the tokenrouter/kimi key, delete the backup bundle (old P0-6) | production only | open |
| O-3 | Vercel project + env vars + auth URLs + `CRON_SECRET`; re-register the ZR webhook (old P0-7) | deploy | open |
| P-1 | Calculator formulas | PRICE-1 final numbers | closed (2026-11-18: owner pasted the exact formulas and test numbers; verified — `docs/specs/PRICE.md`) |
| M-1 | List today's finance accounts and say which fold into DZD and which into USDT | MONEY-1 data mapping | closed (2026-11-18: three accounts ZR / DZD / USDT, default mapping in D39) |
| C-1 | Run `scripts/zr-probe.ts` with the ZR token; Yalidine API id + token when wanted | ZR-3, ZR-4, CARRIER-2 | open |
| C-2 | Delivery-price sheet (wilaya × home/stop-desk) | P1-7 | closed (2026-11-18: `prices/Algeria_numbered.csv`, kept local) |
| S-1 | Store assets: logo + WhatsApp icon files, product photos, policy texts, domain DNS for `luxemodesty.shop` | STORE-2 content, STORE-6 domain | open |
| K-1 | Meta pixel/dataset id + Conversions API token + test event code; TikTok pixel id + Events API token | TRACK-2, TRACK-4 live tests | closed for building (D38: owner enters pixel ids/tokens in Settings; live tests wait for them) |
| T-1 | Create the Telegram bot (BotFather) and give the token | NOTIF-2 live test | closed for building (D38: owner enters the bot token in Settings; live test waits for it) |
| N-1 | Decide: stay on Vercel Hobby (daily cron — reminders arrive late) or a plan with frequent cron | NOTIF timing, tracking outbox latency | open |
| A-1 | Approve the `mcp-handler` dependency; enable Supabase OAuth server (beta) for AI-2 | AI-1, AI-2 | open |
| G-1 | Optional: install `graphify` on this Mac; install and sign in to `agy` (Antigravity CLI) | Antigravity runs | open |

## Owner priority (2026-11-18) — build these first, in this order

Owner, after trying the app: no store management, no product page, the calculator is
still the old one, filters are missing. These rows were moved up from waves 2–5; the
pick rule is unchanged (first eligible `todo`, top to bottom).

| ID | Task | Spec | Risk | Surface | M | Lane | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| ORD-1 | Order number like Lightfunnels (D57): every order gets a per-workspace running number shown as `#0001` everywhere (lists, order sheet, ⌘K search, exports, customer and product pages) instead of the external code or the id fragment; the platform's own number stays as secondary info in the order sheet; seed data uses it too (no more `SEED-0001`). Orders tables: number column narrow (about 5 characters wide), small tabular muted text. Fix in `components/data-table`: the frozen first column keeps its own background, so a selected or hovered row does not tint it — make the frozen cell follow the row's state (selected, hover, keyboard focus) in both themes and in RTL, for every table | CONF | H | ui | M | orders | – | done |
| PRICE-1 | `pricing-v2.ts` engine: the owner's exact formulas (fixed in code), settings as parameters (D38), unit tests pinning every number of the benz test in the spec | PRICE | H | – | – | catalog | – | done |
| PRICE-2 | Pricing settings + per-product overrides + Pricing tab; markup % and rounding rules | PRICE | H | ui | M | catalog | PRICE-1 | done |
| STORE-1 | Options, values, `product_variants`; migrate `products.variants`; per-variant stock | STORE | H | – | M | store | P0-8 | done |
| STORE-2 | `stores`, `store_pages`, theme tokens, public product page (read path, cached) | STORE | H | ui,sec | M | store | STORE-1 | done |
| STORE-3 | Pricing modes, offers, form fields editor + public form rendering | STORE | H | ui | M | store | STORE-2 | blocked:merge needs owner OK — built, v3 merged in, gate OK, 5 review rounds used, review-5 ESCALATE with no high (2 mediums: test depth, a deferred Selling-tab hint) |
| P1-7 | Delivery prices (D27): import the owner's sheet format (wilaya × home/stop-desk, Arabic labels) into `wilaya_fees`; fees editable in Settings → Delivery fees; upload a new CSV to replace them (preview of changes before applying); wilaya without a price = shipping off; home-only wilaya = no stop-desk; commune list from the same file; COD amount pushed = sale·qty + fee (D14) | CARRIER | H | ui | M | orders | P0-8, C-2 | done |
| STORE-4 | Order submit endpoint (server pricing, idempotency, rate limit, bot guard) + thank-you page | STORE | H | ui,sec | M | store | STORE-3, P1-7 | todo |
| CONF-1 | Saved views (table) for confirmation/shipping/all, tabs, URL state, seeded shared views | CONF | H | ui | M | orders | NAV-1 | blocked:Q-18 — built on v3-CONF-1, gate OK, review-4 ESCALATE (2 mediums in the search box); D63: no round 5 without the owner |
| CONF-2 | Kanban layout for views (drag = transition RPC, keyboard equivalent) | CONF | L | ui | – | orders | CONF-1 | todo |
| CONF-3 | Customer score hover card | CONF | L | ui | – | orders | CONF-1 | todo |
| STATS-2 | Wilaya confirmation/delivery table + commune drill-down | STATS | L | ui | – | stats | P1-1 | done |
| STATS-2-F | Follow-up (review-2 PASS): the 12 lows in `docs/briefs/STATS-2.review-2.md` (home/stop-desk drill via `p_delivery_type`, Unknown-row hover, AR chevron direction, impossible `?from` dates, visible `not enough data` on touch, per-commune extras, banner spelling, 120-char commune key, `aria-controls` when closed, chevron hit area 44px, Latin names in AR as product question); missing brief tests listed there; review-1 findings 9 (home/stop-desk drill) and 14 (breadcrumb, none app-wide) | STATS | L | ui | – | stats | STATS-2 | todo |
| STATS-3 | Seasons + unified filter bar | STATS | L | ui | M | stats | STATS-2 | claimed:claude |
| PRICE-3 | Real column (KPI contract + ad spend), below-break-even badge | PRICE | L | ui | – | catalog | PRICE-2, P1-1 | todo |
| PRICE-4 | Portfolio view + CSV; retire BENZ screens | PRICE | L | ui | – | catalog | PRICE-3 | todo |
| STORE-5 | Discount codes + abandoned checkouts | STORE | H | ui,sec | M | store | STORE-4 | todo |
| STORE-7 | Reviews + size guide blocks | STORE | L | ui | M | store | STORE-2 | todo |
| PRICE-2-F | Follow-up (D40, review-4): the two missing keyboard focus tests D53 asked for (focus after a field reset, focus after the Settings reset dialog — needs a DOM test environment or an equivalent); review-2/3/4 lows; calculator component, audit and live `saveProductPricing` tests | PRICE | L | ui | – | catalog | PRICE-2 | todo |
| STORE-1-F | Follow-up (D40, review-4): completeness trigger takes the per-product advisory lock; remove + re-add the same value label in one save fails (23505); `save_variant_config` refuses a size whose values do not match the options (a size with no values made outside the app); real "reserved"-stage size-change test; Size card placement and triple "Choose a size" on the order page; unnamed-option button labels + `role="alert"` on the stale message; remaining workspace-delete cleanups through `test-cleanup.ts` (`cash.test.ts`, `audit-redact.rls.test.ts`, `stock-stages.test.ts:266`) — the fast gate still failed once in 4 runs on the merge result (1 test, output not captured), so the flake is reduced, not gone; review-2 lows 12–14, 18, 19 | STORE | H | ui | M | store | STORE-1 | todo |
| STORE-2-F | Follow-up (D40, review-4): `getStore()` ignores DB errors; `linkPageProduct` skips the active/price check; in-app not-found CTA sends agents to an admin-only page and the agent 404 answers HTTP 200; `createStore` race can leave two stores; `liveStoreSlugs` unpaginated; unknown-store 404 body empty before hydration; AR editor alignment; public page layout at 1280 px; cache-behaviour, agent-session HTTP and `store_pages` cross-workspace tests (`store-http.test.ts` is skipped in the gate) | STORE | H | ui,sec | – | store | STORE-2 | todo |
| ORD-1-F | Follow-up (D59, review-3/4): focused row's ring across the frozen column (review-3 #6); a real Tab-key walk and the EN dark / AR light / delivery screenshots review-4 skipped; missing-counter fallback and search error-path tests; review-3 lows | CONF | L | ui | – | orders | ORD-1 | todo |
| P1-7-F | Follow-up (D62, review-3/4/5): review-5 lows: `home:abc\|home:720` and `home:-5\|home:720` promote the second home label (parser sets `homeSeen` before validating the fee; warn on a colon-less part); `Number()` accepts `0x10` and exponents (check `/^\d+(\.\d+)?$/`); a third home label replaces the stop-desk price (keep the first, warn); the fees grid clears a refused `0` field (restore the typed value, confirm intent); the order-form error stays after the cause is fixed (review-4 #5). Pre-existing medium: swap action throws an uncaught ZodError on a typed wilaya name such as "Chlef" (`orders/actions.ts` `swapOrderSchema.parse`; use `safeParse` and the wilaya Combobox from `components/fields`). Left open by reviews 3-4 (D62 item 7): `switchOrderToHome` guards and translated errors; commune-only apply says "No prices changed" and lists added/removed communes; `loadStoredFees` ignores a failed read; RTL format hint, option labels, accessible names; a swap refused for a stopped wilaya shows the wrong reason; stop-desk switch looks on for a wilaya with no price; swap card uses plain inputs and a text arrow instead of field components and Lucide. Missing tests: parser `home:720\|home:0`, `home:0\|home:0`, malformed first home then second home label; swap with non-numeric `wilaya_code`. | CARRIER | H | ui | – | orders | P1-7 | todo |

## Wave 0 — carried over (launch hardening)

| ID | Task | Spec | Risk | Surface | M | Lane | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| P0-1…P0-5 | Webhook hardening, ZR seam, permission matrix, cash unique index | – | H | sec | – | – | – | done |
| ZR-0, ZR-2 | ZR API audit; ZR status sync | CARRIER | H | sec | – | – | – | done |
| P0-8 | Stock in three stages (D34): in stock / reserved / on road / delivered; returned comes back; swapped holds nothing; stock log add-only (D35). Rework the reconcile target on branch `v3-P0-8` (00028–00030 there): rewrite the brief for D34/D35, keep D30 guard, `swap_order` safe on double submit | CARRIER | H | – | M | orders | O-1 | done |
| P0-8-F | Follow-up (D40, review-7): a swap replacement cancelled at confirmation keeps its piece off the shelf for good — decide and fix; reconcile D40 vs D42 wording on deletion and manual status changes; review-7 lows | CARRIER | H | – | M | orders | P0-8 | done |
| P0-8-G | Follow-up (review-3 lows): decide + enforce whether a swapped original may leave `swap`; `swapOrder` action tests (double submit, non-uuid) | CARRIER | L | – | – | orders | P0-8-F | done |
| CARRIER-0 | Wilayas stay 58 (D26). Fix the dashboard map: centroids 49–58 in `src/lib/geo/algeria-wilayas.ts` are misnumbered vs the seed (review-0 finding 2) and some names are garbled; webhook wilaya name match prefers the longest name. No migration **Next:** code correct (review-3); only open item: Arabic legend still reversed in the 390 px map screenshot, retake or fix, then one review.. | CARRIER | L | ui | – | orders | O-1 | done |
| CARRIER-0-F | Follow-up (D40): Arabic map legend reversed in the 390 px screenshot — fix or retake (review-3) | CARRIER | L | ui | – | orders | CARRIER-0 || done |
| CARRIER-0-G | Follow-up (lows): CARRIER-0-F review-3 lows; map keyboard access; sticky filter panel covering the map on phones (review-2 #5, #6) | CARRIER | L | ui | – | orders | CARRIER-0-F | todo |

## Wave 1 — clarity (owner's main complaint)

| ID | Task | Spec | Risk | Surface | M | Lane | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| NAV-1 | Sidebar: five job-named groups + Home + Settings, always visible, labels en/ar, ⌘K knows old and new names. Branch `v3-NAV-1` exists: fix review-3 (Settings must not squeeze the scrolling nav; distinct icon for Users & roles; no dead chevron), then review light theme, 390 px drawer, icon rail and an agent login **Next:** review-6 open: Escape does not close the 390 px drawer, closed drawer is still tabbable, ⌘K matches internal page keys; then one review.. | NAV | L | ui | – | shell | O-1 | done |
| NAV-1-F | Follow-up (D40): Escape closes the 390 px drawer; closed drawer not tabbable (`inert`); ⌘K must not match internal page keys (review-6) | NAV | L | ui | – | shell | NAV-1 | done |
| SEC-1 | Audit log shows integration secrets (`whsec_…`) in plain text on `/app/settings/audit` (admin-only, found in NAV-1 review-6): redact secret-looking values in `audit_row()` / the audit view (stored and displayed), keep a fingerprint; test with a seeded secret | – | H | sec | M | shell | – | done |
| SEC-1-F | Follow-up (D40, review-4): secret names starting with an acronym (`XAPIKey`, `APISecret`) stay unmasked — split acronym runs when normalising, in SQL and TS; Arabic diff entries run together; review-3/4 lows (fake badge, fingerprint parity table, aria role, screenshots) | – | H | sec | M | shell | SEC-1 | done |
| SEC-1-G | Follow-up (review-3, no leak): SQL and TS redactor outputs still differ exactly at the 64-level depth cap; SEC-1-F review lows; retake 390 px audit screenshots | – | L | ui | – | shell | SEC-1-F | todo |
| NAV-1-G | Follow-up: NAV-1-F review-2 lows; Arabic ⌘K fuzzy-match noise; RTL shows "K⌘" for the shortcut hint | NAV | L | ui | – | shell | NAV-1-F | todo |
| NAV-2 | Breadcrumb + title + required purpose line on every page; group hub pages | NAV | L | ui | – | shell | NAV-1 | todo |
| NAV-3 | Move routes to canonical URLs with permanent redirects; merge the three money surfaces | NAV | L | ui | – | shell | NAV-2 | todo |
| NAV-4 | Emoji in option labels and saved views; label overrides for system statuses | NAV | L | ui | M | shell | NAV-1 | todo |
| NAV-5 | Mobile bottom bar; agent "My day" home | NAV | L | ui | – | shell | NAV-3 | todo |

## Wave 2 — daily operations

| ID | Task | Spec | Risk | Surface | M | Lane | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| P1-1 | KPI contract migration (`orders.excluded_reason`, `kpi_lines`, `product_stock_v`) + tests | STATS | H | – | M | stats | O-1 | done |
| P1-1-F | Follow-up (D40, review-4): drill-down order list filters by UTC day — use Algiers days (D46); `pnl_by_product` cost grows with products × orders — set-based rewrite; review-4 lows | STATS | H | – | M | stats | P1-1 | todo |
| P1-2 | Dashboard v2 (STATS spec §Dashboard v2, D45): needs-action band, money band USD-first, order journey, profit waterfall, stock strip, product scorecard; move the rest to Statistics/Team/Money | STATS | L | ui | – | stats | P1-1 | done |
| P1-2-F | Follow-up (review-2 lows): dashboard polish items + rendered tests for the bands | STATS | L | ui | – | stats | P1-2 | todo |
| TEST-1 | Live test isolation: every live suite creates and cleans its own workspace/orders (cash.test uses up seed orders, so a second gate run fails without `db-reset.sh`); gate must pass twice in a row without a reset | – | L | – | – | shell | – | done |
| CONF-4 | Attempt timeline, callback time, "callbacks due" view | CONF | H | ui | M | orders | CONF-1 | todo |
| CONF-5 | Auto-cancel job + phone blocklist / auto-hold | CONF | H | sec | M | orders | CONF-4 | todo |
| MONEY-1 | Three-account ledger (D39): `kind` zr|dzd|usdt, USDT currency, append-only `account_entries`, "mark ZR payout taken" moves ZR → DZD, constraints, RLS, audit; map old accounts by D39 | MONEY | H | – | M | money | O-1 | todo |
| MONEY-2 | Accounts screen: three cards (ZR / DZD / USDT), quick-add ledger, transfer, mark ZR payout taken | MONEY | L | ui | – | money | MONEY-1, NAV-3 | todo |
| MONEY-3 | "Paid from" on expense/ad-spend forms; statement export | MONEY | L | ui | – | money | MONEY-2 | todo |
| NOTIF-1 | `notifications` + bell + inbox + prefs; task/meeting/order events | NOTIF | H | ui | M | team | O-1 | todo |
| NOTIF-2 | Telegram linking, webhook, outbox worker | NOTIF | H | sec | M | team | NOTIF-1 | todo |
| NOTIF-3 | Admin alerts: stock, balance, stuck orders, daily summary | NOTIF | L | – | – | team | NOTIF-2 | todo |
| P1-5 | Lists: pagination / SQL views for contacts, cash, finance, performance | – | L | ui | – | orders | NAV-3 | todo |

## Wave 3 — catalog intelligence

| ID | Task | Spec | Risk | Surface | M | Lane | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| RES-1 | `research_products` + RLS + board/table + quick add | RES | H | ui | M | catalog | NAV-3 | todo |
| RES-2 | Research detail with embedded calculator | RES | L | ui | – | catalog | RES-1, PRICE-2 | todo |

## Wave 4 — native store

| ID | Task | Spec | Risk | Surface | M | Lane | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| STORE-6 | Collection/home page, policies, custom domain | STORE | H | ui,sec | M | store | STORE-4, S-1 | todo |
| RES-3 | Validate-with-stock + promote to product + draft page | RES | H | ui | – | catalog | RES-2, STORE-2 | todo |
| CONF-6 | Apply an offer during the confirmation call | CONF | H | ui | – | orders | STORE-3 | todo |

## Wave 5 — growth

| ID | Task | Spec | Risk | Surface | M | Lane | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| TRACK-1 | Tracking config + browser pixels + event-id rule | TRACK | H | sec | M | track | STORE-4 | todo |
| TRACK-2 | `order_tracking` capture + outbox + Meta sender (fixtures) | TRACK | H | sec | M | track | TRACK-1 | todo |
| TRACK-3 | Lifecycle events: confirmed / delivered / returned | TRACK | H | sec | – | track | TRACK-2 | todo |
| TRACK-4 | TikTok Events API sender | TRACK | H | sec | – | track | TRACK-2 | todo |
| TRACK-5 | Events screen + match hints + resend | TRACK | L | ui | – | track | TRACK-2 | todo |
| SWAP-1 | Swap fee per delivery company (Settings, like the return fee); swapped original = no sale, swap fee = delivery cost in P&L (D36) | CARRIER | H | ui | M | orders | P0-8 | todo |
| SWAP-2 | Swap suggestion on confirmation: returning parcel with same product/size/colour → admin notification → Approve swap or Create new order (D37) | CARRIER | H | ui | M | orders | SWAP-1, NOTIF-1, STORE-1 | todo |
| ZR-3 | "Your ZR history for this phone" in the confirmation sheet | CARRIER | H | ui | – | orders | C-1 | todo |
| ZR-4 | ZR payments ledger → Money → Courier cash | CARRIER | H | ui | M | money | C-1, MONEY-1 | todo |
| STATS-1 | Customer score fields + reasons | STATS | L | – | M | stats | P1-1 | todo |
| STATS-4 | Time / attempt / product × wilaya cuts | STATS | L | ui | – | stats | STATS-3 | todo |
| CARRIER-1 | Carrier interface + `shipments` (extract from ZR when carrier #2 starts) | CARRIER | H | sec | M | orders | P1-7 | todo |
| CARRIER-2 | Yalidine adapter | CARRIER | H | sec | – | orders | CARRIER-1, C-1 | todo |
| CARRIER-3 | Routing: default carrier per wilaya, then success-rate suggestion | CARRIER | L | ui | M | orders | CARRIER-2, STATS-2 | todo |

## Wave 6 — AI connector and later

| ID | Task | Spec | Risk | Surface | M | Lane | Deps | Status |
|---|---|---|---|---|---|---|---|---|
| AI-1 | MCP route + personal access tokens + read tools + audit | AI | H | sec | M | ai | A-1, P1-1 | todo |
| AI-2 | OAuth for Claude / ChatGPT (verify the two Supabase unknowns first) | AI | H | sec | – | ai | AI-1 | todo |
| AI-3 | Owner guide + example questions | AI | L | – | – | ai | AI-1 | todo |
| P1-6 | Perf: dynamic-import d3 map, next/font, i18n namespace split, exclude webhooks from proxy | – | L | – | – | shell | – | todo |
| LATER-1…5 | Return scanning · page A/B test · WhatsApp confirmation · card prepayment · agent commission | IDEAS | – | – | – | – | owner picks | todo |
| P3 | Google Drive/Calendar OAuth (14h), CSP, last-admin guard, invite orphan cleanup | – | – | – | – | – | – | todo |

## Risks

- RLS suite cannot run on this Mac until O-1: no database-touching `H` task may ship before it does (D24).
- Reconstructed pricing formulas (P-1) — wrong numbers would misprice products.
- Public order endpoint and MCP are new doors: abuse, price tampering, data leak.
- Meta/TikTok facts partly from vendor pages; Meta approval in Algeria unknown (D7).
- Two agents on one repo: claims on `v3` are the lock; migrations are serialised.
- Cohort immaturity misleading rates (D4); migration ordering before deploy.
