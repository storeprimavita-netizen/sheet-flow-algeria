# NAV — navigation and clarity

Design authority: `.claude/skills/cod-ui-polish/references/navigation-ia.md`
(the map, canonical URLs, breadcrumbs, hub pages, emoji policy, mobile bar).
This spec only sequences the work. Visual style does not change (D16).

## Tasks

- **NAV-1 Shell and map.** Rewrite `src/components/nav-model.tsx` to the five
  groups + Home + Settings; groups always visible, user-collapsible, persisted.
  Role filtering stays in `visibleNav`. Group labels and renamed items in
  `nav.*` (en + ar). Command palette lists every page under its new and old
  name. No route moves yet — hrefs still point at today's URLs — so this ships
  alone and is low risk.
- **NAV-2 Where-am-I.** One shared header component: breadcrumb in the top
  bar, title = sidebar label, required purpose line, optional related-links
  row. `PageHeader.subtitle` becomes required; add a purpose line for every
  existing page (en + ar). Group hub pages replace silent redirects.
- **NAV-3 Route moves.** Move routes to the canonical URLs in the reference
  file, one group per step, each with permanent redirects in `next.config.ts`
  and updated internal links. Merge the three money surfaces: Orders → Cash and
  Finance → Income become Money → Courier cash. `/app/contacts` → Sell →
  Customers; suppliers → Money → Suppliers. Read the Next 16 docs for
  redirects and route groups first.
- **NAV-4 Emoji in content.** `options.emoji` (nullable text) + saved-view
  emoji; emoji picker in the option editor; `<Chip>` renders emoji before the
  label. Per-workspace label override for system statuses in Settings →
  Options & labels (keys and colors fixed). Migration → lane `db`.
- **NAV-5 Mobile bar + agent Home.** Bottom bar under 768 px; "My day" for
  agents (queue count, my tasks, next meeting, my confirmation numbers — no
  money, same RLS as today).

## Rules

- Every step ends with `ui-reviewer` screenshots in both themes, AR + EN,
  1280 px and 390 px.
- No behaviour change inside pages during NAV-1..3: same data, same actions,
  same permissions. If a page needs fixing, note it for its own task.
- Agents must never see a link to a page that RLS will refuse.

## Acceptance

The acceptance list at the end of `navigation-ia.md`, plus: every pre-v3 URL
returns a redirect (test in `src/lib/redirects.test.ts` iterating the old list).
