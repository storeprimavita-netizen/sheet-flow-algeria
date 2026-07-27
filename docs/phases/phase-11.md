# Phase 11 — Design system foundation

**Read first:** CLAUDE.md, PROGRESS.md, `docs/design/DESIGN_SYSTEM.md`,
`docs/design/UI_AUDIT.md`, and the `cod-ui-polish` skill with its references
(`design-tokens.md`, `status-system.md`, `components.md`). The design direction
is **decided: A — Slate & Emerald**; build tokens from that table.

## Goal

Lay the design foundation everything else restyles onto: the token layer (both
themes), the status system, the Radix select/combobox that kills the
white-on-white dropdown, the field components, the `/design-preview` mirror, and
the rebuilt navigation. **No feature-page restyling in this phase** — that's
phase 12. This phase makes the tools; phase 12 uses them.

Big phase — if one session can't finish it, stop at a green build after a whole
step and hand off; do not leave a half-written token layer.

## Tasks

1. **Tokens (`src/app/globals.css`).** Rewrite the `:root` (dark) block with
   Direction A values from DESIGN_SYSTEM.md §1; add the missing role tokens
   (`--surface-raised`, `--border-strong`, `--text-muted`/`--text-faint`,
   `--overlay`) and the full semantic pairs (§3, dark). Add a real
   **`.light { … }`** block (A light column + §3 light). Map every new token in
   `@theme inline`. **Delete** `--gradient-primary`, `--gradient-card`,
   `--shadow-glow`, `.glass-card`, `.text-gradient`, and the `body`
   `background-image` gradients. Fix the one hardcoded color
   (`app-shell.tsx:130` → `--overlay`). Add the `.num` tabular-numeral utility.

2. **Theme switch.** Wire `.light`/`.dark` on `<html>` from a persisted
   preference (cookie, same pattern as locale) + system default; expose a
   control (used by Settings → Appearance in phase 12, but the toggle mechanism
   lands here so `/design-preview` can flip).

3. **shadcn + Radix (`.mcp.json` has the shadcn MCP).** Install `select`,
   `popover`, `command`, `dialog`, `dropdown-menu`, `sheet`, `tooltip`,
   `checkbox`, `switch`, `toast` (or sonner). Theme them centrally to the
   tokens. **Replace `components/ui/select.tsx`** (native `<select>`) with the
   Radix Select on `--surface-raised`; add a `Combobox` (Popover + Command) for
   searchable selects. This is the fix for UI_AUDIT G2.

4. **Status system.** Create `src/lib/statuses.ts` — the source of truth from
   `status-system.md`: each status exports `key`, `label` (i18n key), `token`,
   `icon` (lucide), `next[]`, `terminal`, `requiresConfirm`. Build
   `<StatusPill>` (dot + icon + label, tinted bg + strong fg) and the shared
   `<Chip>` base. Build `<StatusSelect>` (pill in trigger and every option,
   offers only `next[]`). **Do not** rewire feature pages yet — just export and
   prove them in `/design-preview`.

5. **Field components (`src/components/fields/`).** Build the inventory from
   `components.md`: `MoneyField` (DZD + USD/EUR w/ live conversion),
   `PercentField`, `PhoneField` (Algerian normalize + dup hint hook),
   `WilayaCombobox` (58 wilayas), `CommuneCombobox`, `ProductCombobox`,
   `QuantityStepper`, `DateField`, `DateRangeField` (presets),
   `CategorySelect`, `OptionSelect`/`OptionMultiSelect` (inline `+ Create` —
   option-sets backend may be stubbed until phase 12; see note),
   `AutoTextarea`, `SettingSwitch`. Apply the form-layout rules. Again: prove in
   `/design-preview`, don't swap feature pages yet.

6. **`/design-preview` route.** Build per DESIGN_SYSTEM.md §8 — every token and
   component in both themes with a theme + RTL toggle. Gate to
   `NODE_ENV !== 'production'` or admin. This is the mirror for phases 12–13.

7. **Navigation rebuild (`src/components/app-shell.tsx`).** Fix UI_AUDIT G6:
   always-expanded subsections (Orders → All/Confirmation/Delivery; Finance →
   Overview/Expenses/Ad spend/Income; Contacts → Customers/Suppliers; Team →
   Rules/Meetings/Tasks/Performance/Users/Audit log). Active state = bg tint +
   left accent bar + colored icon. Live counters (Confirmation pending, Delivery
   awaiting deposit, Tasks my-open), muted at zero. Collapsible icon-rail,
   persisted. **⌘K command palette** (Radix Command): navigate + search orders
   by phone/ID + products/customers + actions ("Add ad spend", "New order"). `?`
   shortcut overlay. Finance links render only for admin (RLS already enforces).

   > **Note:** a `/app/finance` section does not exist yet (finance is scattered
   > in Orders "Cash" + product tabs). Phase 11 adds the nav entries and route
   > shells (can be thin placeholders redirecting to existing pages); phase 12
   > builds Finance Overview/Expenses/Ad spend/Income properly.

## Acceptance criteria

- `grep -rnE 'text-white|bg-white|#[0-9a-fA-F]{3,6}|rgb\(|glass-card|text-gradient'`
  over `src` (excluding `globals.css` token defs) returns **zero**.
- Both themes correct on `/design-preview`; every semantic pair ≥ 4.5:1
  (readout on the page flags failures — none may fail).
- Opening any Radix Select/Combobox shows a properly-surfaced, readable list in
  **both** themes (the white-on-white bug is gone).
- `<StatusPill>` renders every status with its icon; `<StatusSelect>` shows the
  pill in trigger and options and offers only legal transitions.
- Sidebar shows all subsections expanded, Finance visible to admin only, live
  counters correct, ⌘K opens and navigates.
- **Screenshot self-critique**: capture `/design-preview` and the shell in both
  themes to `docs/design/audit/preview-{dark,light}.png`; fix what the shots
  show; note in PROGRESS.md what was captured and fixed.
- `npm run build` green; `npm test` green.
