# Design tokens

Dark is the default. Design dark first, derive light second, verify both.

## Color architecture

Define every color as a CSS variable on `:root` (dark) and `.light`, consumed through Tailwind theme extension or `hsl(var(--x))`. Feature code never names a color.

Required roles:

```
--bg              app background        (deep neutral, NOT pure black — around 6–9% lightness)
--surface         cards, tables, sheets (one step lighter than bg)
--surface-raised  popovers, dropdowns, modals (one step lighter again — this is what fixes
                  the white-on-white dropdown bug: SelectContent MUST set a background)
--border          hairline separators   (low contrast, visible but quiet)
--border-strong   focused/active edges
--text            primary text          (NOT pure white — slightly dimmed for long sessions)
--text-muted      labels, secondary
--text-faint      placeholders, disabled
--primary         one accent, used sparingly: primary buttons, active nav, focus ring
--primary-fg      text on primary
--focus           focus ring (visible on every interactive element)
```

Semantic pairs, each with a **tint background + strong foreground** variant so pills stay readable at 12px:

```
--success / --success-bg      delivered, confirmed, profit
--warning / --warning-bg      no answer, delayed
--danger  / --danger-bg       cancelled, loss, overdue
--info    / --info-bg         in transit, deposited
--neutral / --neutral-bg      waiting, not started
```

Dark-theme rules that this project got wrong before:
- Elevation is expressed by **lighter surfaces and borders**, not heavy drop shadows.
- Status colors need **higher lightness and lower saturation** than their light-theme values to clear 4.5:1 on dark surfaces. Define both variants explicitly; never reuse the light value.
- Disabled state = reduced opacity on text plus a flatter surface, never a lighter-than-background box.
- Charts need their own dark-safe series palette (5 hues max), colorblind-safe, defined as tokens.

## Typography

- One UI face for everything, plus **tabular numerals for all money and metrics** (`font-variant-numeric: tabular-nums` on a `.num` utility applied to every money/percent cell).
- Scale: 12 (captions, table meta) / 14 (body, table cells — the workhorse) / 16 (section titles) / 20 / 24 / 32 (KPI numbers).
- Weights: 400 body, 500 labels and table headers, 600 titles and KPI numbers. Avoid 700+ except for the single largest number on a card.
- Line height 1.4 for data, 1.6 for prose blocks (rules, meeting notes).
- Must render French accents and Arabic characters correctly — verify with a real customer name.

## Spacing, radius, elevation, motion

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32. Nothing else. Card padding 16 (compact) or 24 (comfortable).
- Table row height ~44px comfortable, ~36px compact, with a density toggle that persists per user.
- One radius value everywhere (suggest 8px; 6px on small controls, full on pills). Never mix three radii on one screen.
- Elevation: exactly two levels — flat (cards) and raised (popover/modal/sheet). Raised gets a border plus a subtle shadow.
- Motion: 150–200ms ease-out for hover/press/appear. Sheets and dialogs slide/fade. Nothing else animates. Respect `prefers-reduced-motion`.

## Icons

`lucide-react`, 16px inside table cells and buttons, 20px in navigation, 1.5–2px stroke, always paired with a text label except in icon-only buttons which require `aria-label`. One icon per concept across the whole app — the truck means "in transit" everywhere or nowhere.

## Formatting

- Money: `1 234 567 DA` (space separator, no decimals unless under 100). Foreign currency shows the original plus the DZD conversion and the rate used.
- Percent: one decimal max (`64.3%`).
- Dates: `26 Jul 2026`, times 24h, displayed in Africa/Algiers. Relative time ("4 min ago") only for freshness indicators.
- Zero and null are different: `0 DA` is a value, `—` is missing. Never show `NaN`, `null`, or `Infinity%`.
