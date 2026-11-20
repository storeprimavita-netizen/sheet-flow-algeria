# GROW — channel, spam shield, SEO/AIEO, upsells, live visitors

Owner, 2026-11-19. All of it sits on the native store (STORE). Decisions D71–D75.

## 1. Channel replaces "Source" (SRC-1, D71)

The old "Source / المصدر" column said which platform sent the order (Shopify,
Lightfunnels, manual). The store is now inside the app, so that is noise.

- **Channel** = where the customer came from: Facebook · Instagram · TikTok ·
  Google · Snapchat · WhatsApp · Direct (typed the link / no referrer) · Other
  site · Manual (order typed by the team). Shown as a chip with the platform's
  line icon; label "Channel / القناة".
- Decided by the server at order submit, first match wins: click id
  (`fbclid` → Facebook or Instagram by `utm_source`, `ttclid` → TikTok,
  `gclid`/`gbraid` → Google, `ScCid` → Snapchat) → `utm_source` → referrer
  host → Direct. The first landing of the visit is what counts (stored in the
  visitor cookie), not the last page. Raw `utm_*`, referrer and landing page
  are kept on the order (admin-only) for campaign reports.
- Manual orders: the agent picks the channel (default Manual; WhatsApp and
  Instagram DM are common).
- Filter and group by channel in order views; Statistics gets orders,
  confirmation %, delivery % and (admin) cost per delivered **per channel**.
- `orders.source` (technical origin: store / manual / legacy webhook) stays in
  the database, hidden. Shopify and Lightfunnels settings move under a
  collapsed "Legacy imports" group; their webhooks keep working if a secret is
  set (D6). Nothing is deleted.

## 2. Spam shield — IP blocking (SHIELD-1, D72)

Settings → Store → Protection (admin):
- On/off. Rule: more than **N orders from one IP in M minutes** (defaults 3 in
  10) → action.
- Action (D80): **block** — that IP cannot order for **1 hour · 1 day · custom
  (minutes/hours/days) · until I unblock**. This is the default. Every blocked
  attempt is saved in the checkouts list (STORE-5) with a **"Blocked IP"**
  label: what was typed (name, phone, wilaya, product), time, and the IP for
  admins; it is not an order. From that row an admin can unblock the IP or
  turn the attempt into a real order. Optional other action: **hold for
  review** (order accepted but kept out of the agents' queue).
- Manual list: block or unblock an IP by hand (from an order's detail or by
  typing it), with reason and expiry; list shows who blocked, when, how many
  orders were stopped.
- A blocked visitor sees a calm message with the WhatsApp link — never an
  error page, never "you are blocked".
- **Warning shown in the settings:** Algerian mobile operators put many
  customers behind the same IP. A long block on a mobile IP can stop real
  buyers — keep the window short (minutes) and check the Blocked IP rows; blocks by phone number
  (CONF-5) are more precise. The rule counts distinct phone numbers too: many
  orders with the **same** phone are duplicates (already handled), many with
  **different** phones from one IP in minutes is the spam signal.
- Checked server-side in the order endpoint before any row is written. The IP
  is stored on the order's tracking row (admin-only), never shown to agents.
- Tests: threshold trips at N+1 · block expires on time · manual unblock ·
  hold keeps the order out of agent queues · blocked request writes no order.

## 3. SEO and AIEO (SEO-1, SEO-2, D73)

Goal: someone searching a product or a store in Algeria — on Google or by
asking an AI assistant — finds the store. Honest limit: no engine can
guarantee a position; this makes every page as findable and quotable as it
can be, and shows the owner what is missing.

**SEO-1 — foundation (every public page)**
- Server-rendered title, description, canonical URL, Open Graph/Twitter image,
  `lang="ar" dir="rtl"`, and French alternates when a page has a French version.
- Structured data (JSON-LD): `Product` + `Offer` (price in DZD, availability,
  COD as payment, delivery area Algeria), `AggregateRating` only from real
  reviews, `Organization`/`OnlineStore` (name, logo, phone, social links),
  `BreadcrumbList`, `FAQPage` for the FAQ block.
- `sitemap.xml` (published pages only, with last-modified and images),
  `robots.txt`, clean readable URLs (`/p/caftan-orkid`), 404 for unpublished.
- Per page in the editor: SEO title, description, URL slug, keywords in Arabic
  and French (and Darija spellings customers actually type), image alt texts.
  A **checklist with a score** next to it: title length, description, a
  keyword in title and first paragraph, alt texts, price present, at least
  one review, page speed result. Suggestions are text hints, nothing auto-written
  without the owner pressing a button.
- Speed is part of ranking: the store skill's speed budget applies.

**SEO-2 — AI answers and shopping surfaces**
- `/llms.txt`: a plain summary of the store for AI assistants — what it sells,
  delivery to which wilayas and at what prices, payment on delivery, return
  policy, contact, and links to the product pages.
- Each product page carries a short "facts" block in plain sentences (what it
  is, fabric, sizes, price, delivery time, COD) — the form AI assistants quote.
- Setting: allow or disallow AI crawlers in `robots.txt` (default allow).
- Product feed for Google Merchant Center (free listings) and Meta catalogue
  (same feed): id, title, description, price, availability, image, link,
  variants. Optional IndexNow ping on publish.
- Search Console / Merchant Center / Bing verification tags as settings.
- Needs the store's own domain to matter (owner input S-1).

## 4. Upsell, downsell, cross-sell / mix (SELL-1, SELL-2, D74)

Per product, in Store → Forms & offers:
- **Order bump** (in the form): a ticked box adds a small product at a special
  price to the same order.
- **Cross-sell / mix**: "complete the look" — choose 1–3 other products shown
  under the form; and **mix bundles**: a set of different products sold
  together at a bundle price (each line keeps its own variant and stock).
- **Upsell** (after the order is placed, on the thank-you page): one offer to
  add or upgrade — "add the matching hijab for 900 instead of 1,400" or
  "take 2 for …" — accepted with one tap, no retyping. It joins the **same
  order** while it is still waiting for confirmation.
- **Downsell**: shown only if the upsell is declined — a cheaper alternative.
  One upsell and at most one downsell per order; never a chain.
- The confirmation agent sees accepted and declined offers on the order and
  can apply the same offers by phone (CONF-6).
- Server computes every price; stock is checked per line; an offer for an
  out-of-stock item is not shown. Declining is one clear tap ("لا شكراً") —
  no pre-ticked boxes, no hidden buttons, no countdown that is not real.
- Reports: shown / accepted / revenue per offer; average order value with and
  without offers.

## 5. Live visitors (LIVE-1, D75)

Store → Live (admin), like Shopify's live view:
- Visitors on the store right now, and in the last 30 minutes; which pages;
  how many are filling the form; orders in the last 30 minutes; by channel.
- **Map of Algeria by wilaya** (reuse the dashboard map) with a list beside it.
- Location: from the hosting edge's IP lookup (region/city → wilaya). **Stated
  in the UI as approximate**: mobile connections often resolve to Algiers or
  another hub, so the map shows "approximate (network)" until the visitor
  picks her wilaya in the form, which then replaces it ("exact (chosen)").
- How: the store sends a small heartbeat every ~30 s with an anonymous visitor
  id, page, and channel. No name, no phone, **no raw IP stored** — only the
  derived wilaya. Raw rows are deleted after 48 hours; daily totals are kept.
  The privacy policy says so.
- Public write endpoint: rate-limited, size-capped, ignores bots, never slows
  the page (sent after the page is interactive). The admin screen refreshes
  every few seconds; realtime is optional.
- Feeds abandoned checkouts (STORE-5) and the channel funnel (visits → form
  started → ordered) in Statistics.

## 6. Microsoft Clarity (CLARITY-1, D81)

Store → Tracking: paste the Clarity project id for a store. The script loads on
public store pages only, after the page is interactive, so it never delays the
order button. Fields the customer types (name, phone, address, note) carry
Clarity's mask attribute so they do not appear in recordings or heatmaps. A
link opens that store's Clarity dashboard. Off when the id is empty; no
recordings from the back office.

## Tasks

SRC-1 · SHIELD-1 · CLARITY-1 · SEO-1 · SEO-2 · SELL-1 (bump, cross-sell, mix bundles) ·
SELL-2 (post-order upsell + downsell) · LIVE-1.
