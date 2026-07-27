# Design System — MNW COD ERP

The canonical token + component spec for phases 11–13. The *rules* (why, how to
apply) live in `.claude/skills/cod-ui-polish/references/` (`design-tokens.md`,
`status-system.md`, `components.md`). This file holds the **concrete values**:
the two candidate
directions, the full status color table in both themes, the type/space scales,
the chart palette, and the `/design-preview` route spec.

> **Status: DIRECTION DECIDED → A "Slate & Emerald"** (approved 2026-07-27).
> Phase 11 writes tokens from Direction A (§1). Direction B is kept below for the
> record only — do not build it. Everything else (status table, scales, component
> contracts) is direction-independent and final.

All colors are OKLCH (`oklch(L C H)`), consumed as CSS variables. Feature code
never names a color — only tokens. Dark is authored first; light is a complete
sibling, not an afterthought.

---

## 1. Two directions

Both are dark-first, high-contrast, quiet — appropriate to a logistics/finance
tool used all day. They differ only in **surface hue** and **the single accent**.
The semantic status palette (§3) is shared, so pills look identical in both.

Deliberately avoided: cream+terracotta serif, black+acid-green, newspaper
hairlines (the generic-AI tells the brief names). Current app is closest to A
but with an over-saturated accent and heavy glass/gradient decoration.

### Direction A — "Slate & Emerald" (evolve the current look) ✅ CHOSEN

Cool deep-slate surfaces, a **restrained emerald** accent (lower chroma than
today's, so it reads confident not neon). Familiar to the team, lowest risk.
**This is the approved direction — build tokens from this table.**

| Token | Dark | Light |
|---|---|---|
| `--bg` | `oklch(0.16 0.02 250)` | `oklch(0.985 0.003 250)` |
| `--surface` | `oklch(0.205 0.022 250)` | `oklch(1 0 0)` |
| `--surface-raised` | `oklch(0.255 0.026 250)` | `oklch(0.995 0.004 250)` |
| `--border` | `oklch(1 0 0 / 9%)` | `oklch(0.22 0.03 250 / 12%)` |
| `--border-strong` | `oklch(1 0 0 / 18%)` | `oklch(0.22 0.03 250 / 22%)` |
| `--text` | `oklch(0.96 0.006 250)` | `oklch(0.22 0.02 250)` |
| `--text-muted` | `oklch(0.72 0.016 250)` | `oklch(0.46 0.02 250)` |
| `--text-faint` | `oklch(0.55 0.014 250)` | `oklch(0.62 0.018 250)` |
| `--primary` | `oklch(0.70 0.13 162)` | `oklch(0.55 0.14 162)` |
| `--primary-fg` | `oklch(0.16 0.02 250)` | `oklch(0.99 0 0)` |
| `--focus` | `oklch(0.70 0.13 162 / 65%)` | `oklch(0.55 0.14 162 / 55%)` |
| `--overlay` | `oklch(0 0 0 / 55%)` | `oklch(0.2 0.02 250 / 40%)` |

### Direction B — "Graphite & Azure" (neutral terminal)

Near-neutral graphite surfaces (almost no hue), a **confident azure** accent.
The neutral ground makes status colors pop harder — status is the primary
information, so this maximizes it. Reads more like a trading/ops console.

| Token | Dark | Light |
|---|---|---|
| `--bg` | `oklch(0.17 0.004 265)` | `oklch(0.985 0.002 265)` |
| `--surface` | `oklch(0.212 0.005 265)` | `oklch(1 0 0)` |
| `--surface-raised` | `oklch(0.262 0.007 265)` | `oklch(0.996 0.003 265)` |
| `--border` | `oklch(1 0 0 / 10%)` | `oklch(0.2 0.01 265 / 12%)` |
| `--border-strong` | `oklch(1 0 0 / 19%)` | `oklch(0.2 0.01 265 / 22%)` |
| `--text` | `oklch(0.95 0.004 265)` | `oklch(0.21 0.01 265)` |
| `--text-muted` | `oklch(0.71 0.008 265)` | `oklch(0.45 0.012 265)` |
| `--text-faint` | `oklch(0.54 0.008 265)` | `oklch(0.61 0.012 265)` |
| `--primary` | `oklch(0.68 0.15 248)` | `oklch(0.55 0.17 248)` |
| `--primary-fg` | `oklch(0.15 0.01 265)` | `oklch(0.99 0 0)` |
| `--focus` | `oklch(0.68 0.15 248 / 65%)` | `oklch(0.55 0.17 248 / 55%)` |
| `--overlay` | `oklch(0 0 0 / 55%)` | `oklch(0.2 0.01 265 / 40%)` |

**Elevation** in both: no drop shadows on flat cards. Cards = `--surface` +
`--border`. Raised (popover/dropdown/modal/sheet) = `--surface-raised` +
`--border-strong` + one subtle shadow `0 8px 24px -12px oklch(0 0 0 / 45%)`
(dark) / `0 8px 24px -12px oklch(0.2 0.02 265 / 18%)` (light). **No
`glass-card`, no body gradient, no `text-gradient`** — those are removed.

---

## 2. What changes vs. today's `globals.css`

Keep the OKLCH architecture and the `@theme inline` mapping. Changes:
- Add the missing role tokens: `--surface-raised`, `--border-strong`,
  `--text-muted`/`--text-faint` (rename `muted-foreground`), `--overlay`, and
  the full semantic pairs in §3.
- Add a real `.light { … }` block (currently absent).
- Delete decorative utilities: `--gradient-primary`, `--gradient-card`,
  `--shadow-glow`, `.glass-card`, `.text-gradient`, and the `body`
  `background-image` radial gradients.
- Lower the accent chroma (both directions do this).

---

## 3. Status & semantic colors (shared, final, direction-independent)

Each is a **tinted background + strong foreground** pair so a 12px pill clears
4.5:1 on its surface. Never a saturated fill with white text. Dark values are
higher-L / lower-C than light, per the dark-contrast rule.

### Semantic base

| Role | Dark fg | Dark bg | Light fg | Light bg |
|---|---|---|---|---|
| `success` | `oklch(0.80 0.14 158)` | `oklch(0.80 0.14 158 / 15%)` | `oklch(0.48 0.13 158)` | `oklch(0.48 0.13 158 / 12%)` |
| `warning` | `oklch(0.83 0.13 78)` | `oklch(0.83 0.13 78 / 15%)` | `oklch(0.55 0.12 70)` | `oklch(0.55 0.12 70 / 13%)` |
| `danger` | `oklch(0.72 0.16 25)` | `oklch(0.72 0.16 25 / 16%)` | `oklch(0.52 0.19 25)` | `oklch(0.52 0.19 25 / 12%)` |
| `info` | `oklch(0.75 0.13 242)` | `oklch(0.75 0.13 242 / 15%)` | `oklch(0.52 0.15 242)` | `oklch(0.52 0.15 242 / 12%)` |
| `neutral` | `oklch(0.74 0.02 250)` | `oklch(1 0 0 / 8%)` | `oklch(0.45 0.02 250)` | `oklch(0.2 0.02 250 / 7%)` |

### Extended hues (for statuses that need a distinct color)

| Role | Dark fg | Dark bg | Used by |
|---|---|---|---|
| `indigo` | `oklch(0.72 0.14 275)` | `.../15%` | in transit |
| `cyan` | `oklch(0.78 0.12 210)` | `.../15%` | out for delivery |
| `violet` | `oklch(0.74 0.15 300)` | `.../15%` | stop desk waiting |
| `orange` | `oklch(0.76 0.15 55)` | `.../15%` | closed phone, returning |
| `rose` | `oklch(0.70 0.17 10)` | `.../16%` | returned |

Light variants: subtract ~0.22 L, add ~0.02 C, bg at 12%.

### Status → token map (source of truth = `lib/statuses.ts`)

**Confirmation**: `wait_for_confirmation`→neutral·clock · `no_answer`→warning·phone-missed
· `closed_phone`→orange·phone-off · `cancelled`→danger·x-circle · `confirmed`→success·check-circle-2

**Delivery**: `wait_for_deposit`→neutral·package · `bureau_deposited`→info·building-2
· `in_transit`→indigo·truck · `out_for_delivery`→cyan·navigation · `stop_desk_waiting`→violet·map-pin
· `delivered`→success·check-check · `delayed`→warning·clock-alert · `cancelled`→danger·x-circle
· `returning`→orange·corner-up-left · `returned`→rose·undo-2

**Product**: `to_be_tested`→neutral·flask-conical · `tested`→info·beaker · `confirmed`→success·badge-check · `cancelled`→danger·ban

**Task**: `todo`→neutral·circle · `doing`→info·circle-dot · `blocked`→danger·octagon-alert · `done`→success·circle-check

**Risk badge**: green `shield-check` (success) / amber `shield-alert` (warning) / red `shield-x` (danger).
**Source badges** (not statuses): outlined chips, neutral border, distinct icon — Shopify / LightFunnels / Manual. Never colored like state.

### Money color-coding

Profit → `success` fg. Loss/negative → `danger` fg. Zero → `--text`. `—` for
null. Applied to any signed money figure (net profit, margin, deltas).

---

## 4. Chart palette (both themes)

Max 5 series, colorblind-safe, token-derived, distinct from status colors so a
chart series isn't mistaken for a state.

```
--chart-1: primary            (accent of the chosen direction)
--chart-2: oklch(0.75 0.13 242)   azure/info
--chart-3: oklch(0.80 0.13 78)    amber
--chart-4: oklch(0.74 0.15 300)   violet
--chart-5: oklch(0.78 0.12 200)   teal
```
Sequential scale for the wilaya choropleth: 5 steps from `danger` (low rate) →
`neutral` (not enough data) → `success` (high rate). Legend shows the ranges.

---

## 5. Typography

- **One UI face**: IBM Plex Sans (already loaded) + IBM Plex Sans Arabic for AR.
  Keep. Add a `.num` utility: `font-variant-numeric: tabular-nums` — applied to
  **every** money/percent/count cell.
- Scale (px): `12` caption/table-meta · `14` body/table-cell (workhorse) ·
  `16` section title · `20` · `24` · `32` KPI number.
- Weights: `400` body · `500` labels, table headers · `600` titles, KPI numbers.
  `700` only for the single largest number on a card. No 800+.
- Line-height: `1.4` data, `1.6` prose (rules, meeting notes).
- Verify FR accents ("Béjaïa", "Sétif") and an AR customer name render clean.

## 6. Spacing, radius, motion

- Space scale: `4 / 8 / 12 / 16 / 24 / 32`. Nothing else. Card padding 16
  (compact) or 24 (comfortable).
- Row height: `44px` comfortable / `36px` compact, density toggle persists per user.
- **Radius: `8px`** base, `6px` small controls, `full` on pills. One radius per
  screen — no mixing.
- Motion: `150–200ms` ease-out for hover/press/appear; sheets & dialogs
  slide+fade. Nothing else animates. Respect `prefers-reduced-motion`.

## 7. Icons

`lucide-react`. 16px in cells/buttons, 20px in nav, 1.5–2px stroke. One icon per
concept app-wide (truck = in-transit everywhere). Icon-only buttons need
`aria-label`.

---

## 8. `/design-preview` route (build in phase 11)

A single page at `/design-preview` (dev-only; gate behind admin or `NODE_ENV`),
the mirror for every subsequent UI task. Renders **every token and component in
both themes side by side**, with a theme toggle and an RTL toggle. Sections:

1. **Swatches** — every color token as a labeled chip with its computed value,
   dark and light columns; a contrast readout (fg-on-bg ratio) beside each
   semantic pair, flagging anything under 4.5:1.
2. **Typography** — the full scale with FR + AR sample strings; a money column
   proving tabular alignment.
3. **Status pills** — every confirmation/delivery/product/task status via
   `<StatusPill>`, plus risk and source badges; shown in a table cell, in a
   select trigger, and inside an open select option list.
4. **Fields** — one of each `components/fields/` control, empty + filled +
   error + disabled: Money (DZD + USD w/ conversion), Percent, Phone (with dup
   hint), Wilaya combobox (open), Commune (dependent), Product combobox,
   Quantity stepper, Date, DateRange (presets open), CategorySelect,
   OptionSelect (with `+ Create` row), AutoTextarea, SettingSwitch.
5. **Buttons** — variants × sizes × states (default/hover/loading/disabled),
   destructive separated.
6. **Data table** — a 5-row sample with sticky header, sortable numeric column
   (tabular), status column, kebab, bulk-select bar, and its empty/loading/error
   states.
7. **Cards & charts** — a KPI card (number/delta/sparkline), the four chart
   types with their empty + loading states, and the wilaya choropleth legend.
8. **Feedback** — toast (success/error/undo), confirm dialog, skeleton block.

Acceptance: no hardcoded color on the page; every item legible and ≥4.5:1 in
both themes; screenshot both themes into `docs/design/audit/preview-{dark,light}.png`.

---

## 9. Component contracts (summary; full detail in references)

- `<StatusPill status kind size>` — dot + icon + label, tinted bg + strong fg;
  used in cells, sheets, filter chips, and inside select triggers/options.
- `<Chip>` — the shared base for status pills and user-created option chips
  (one palette, §3 + option-set colors).
- `components/fields/*` — the inventory in `references/components.md`. No raw
  `<input>` in feature code after phase 11.
- `components/data-table/*` — sticky header/first-col, URL-persisted
  filter+sort, server pagination, virtualize >200 rows, row→sheet, bulk bar.
- `Select`/`Combobox` — Radix/shadcn on `--surface-raised` (replaces the native
  `<select>` that caused the white-on-white bug).

The `cod-ui-polish` skill (`.claude/skills/cod-ui-polish/`) and its references
are the working authority during execution; this file is the value table they
point at.
