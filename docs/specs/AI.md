# AI — connector for Claude, ChatGPT and Antigravity (MCP)

Goal: the owner connects an AI assistant to the platform and asks questions
about their own data ("which wilayas should I stop shipping this product to?").
Read-only in v1. Risk high, surface security: this is a new public door.

Client requirements were read from each vendor's docs on 2026-11-17; re-check
them in the brief — these products change quickly.

## Shape

A remote MCP server inside the app: `src/app/api/mcp/route.ts`, Streamable
HTTP (the only transport all three clients accept; SSE is being retired),
stateless. Candidate library: `mcp-handler` (Vercel) — a new dependency, so it
needs owner approval in the brief (stop condition). `src/proxy.ts` must not
redirect `/api/mcp` or `/.well-known/*` to the login page.

## Auth — two modes

| Mode | For | How |
|---|---|---|
| **Personal access token** (AI-1) | Antigravity (supports static headers), scripts | Admin creates a token in Settings → Integrations → AI connector; shown once, stored hashed, scoped read-only, expiring, revocable. Sent as `Authorization: Bearer`. |
| **OAuth 2.1** (AI-2) | Claude custom connector, ChatGPT connector | Supabase Auth's OAuth server (beta) with dynamic client registration and our own consent page; protected-resource metadata (RFC 9728) served by the app. Unconfirmed and to verify first: whether Supabase supports CIMD, and whether it sets `aud` to the resource as ChatGPT expects. If either fails, AI-2 stops and reports — do not hand-roll an OAuth server. |

Either way the request ends up as a normal admin-scoped query: tokens map to a
user, tools run with that user's RLS. **Admin role required**; an agent's
token gets no tools. Every call is written to `audit_log` (who, tool, params,
row count).

## Tools (v1, all read-only, all capped)

`kpi_summary(period, filters)` · `orders_search(filters, limit ≤ 200)` ·
`product_stats(product?, period)` · `wilaya_stats(period, product?)` ·
`customer_score(phone | id)` · `money_overview(period)` · `accounts_balances()`
· `stock_levels()` · `pricing_scenarios(product)` · `list_products()`.

- Results are aggregates by default. `orders_search` masks phone numbers
  (`0551 •• •• 67`) and omits addresses unless the token was created with
  "include customer contact details".
- Hard caps: rows, payload size (stay far below the clients' ~150k-character
  limit), 30 s per call. Paginate rather than truncate silently — a truncated
  result says so.
- No tool writes anything. Write tools (create task, change status) are a
  later decision with their own review.

## Prompt-injection stance

Customer names, addresses, comments and webhook payloads are untrusted text
that an assistant will read. Tools return them as clearly delimited data
fields, never inside instructions, and the server description says so. The
connector cannot act, so the worst case is a misleading answer, not an action
— which is the reason v1 is read-only.

## Connecting (documented for the owner once built)

- Antigravity: `.agents/mcp_config.json` or `~/.gemini/config/mcp_config.json`
  with `serverUrl` + `headers` (token), or OAuth.
- Claude: Settings → Connectors → add custom connector with the server URL.
- ChatGPT: connector settings → server URL ending in `/mcp`; plan
  availability is reported inconsistently — check on the owner's account.

## Tasks

AI-1 MCP route + PAT auth + read tools + audit (risk high) · AI-2 OAuth for
Claude/ChatGPT (after verifying the two Supabase unknowns) · AI-3 owner guide
+ example questions.

## Acceptance

No token → 401 with the metadata pointer · agent-role token → empty tool list
· revoked/expired token refused · a tool cannot return another workspace's
row (RLS test with two workspaces) · phone masking on by default · every call
audited.
