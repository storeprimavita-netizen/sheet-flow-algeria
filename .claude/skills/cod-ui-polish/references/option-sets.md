# Option sets — Notion-style selects (predefined + add your own)

Several fields in this app are taxonomies the team grows over time: they must ship with sensible defaults **and** let a user create a new option inline, without leaving the form or asking an admin.

## Two kinds of "status-looking" fields — never confuse them

| Kind | Examples | Editable by users? |
|---|---|---|
| **System statuses** | order confirmation status, delivery status, product status, task status | **No.** Keys are fixed because business logic, RLS, and statistics depend on them. Admins may edit the *display label* and *color*, never add or remove keys. |
| **Option sets** | supplier/atelier type, product category, tissu/fabric, expense subcategory, order tags, cancellation reason, task priority, customer tags | **Yes.** Users create, rename, recolor, reorder, archive. |

Any new dropdown you add: decide which kind it is first, and say so in the code.

## Data model

```
option_sets (id, workspace_id, key, label, allows_multi, created_at)
options     (id, workspace_id, set_id, label, color_token, icon, sort_order,
             archived_at, created_by, created_at)
```

Referencing rows store the **option id** (FK), never the label string — so renaming an option updates it everywhere at once, retroactively. Seed each set with defaults on workspace creation (e.g. atelier types: studio shooting, atelier couture, emballage, livreur, fournisseur tissu).

## Select behavior (this is the Notion part)

- Type to filter. If nothing matches, the last row is **`+ Create "atelier broderie"`** — one click creates it and selects it, staying in the form.
- New options get an auto-assigned color from the palette (cycling so adjacent options differ), changeable afterwards.
- Each option row in the dropdown shows its chip exactly as it will appear once selected. What you pick is what you see.
- Multi-select variant: selected options render as removable chips inside the trigger, with a count when they overflow; backspace removes the last one.
- Right-click or a kebab on an option (admins) → Rename · Change color · Change icon · Archive.
- **Archive, never hard-delete**: archived options disappear from the picker but still render on historical records, greyed with a tooltip ("Archived option"). Deleting is only offered when usage count is zero.
- Show usage count next to each option in the management view ("used by 14 suppliers"), and offer **merge into another option** — the single most requested cleanup after a team has been typing freely for months.
- Manage all sets in Settings → Options, but inline creation from the form is the primary path.

## Chip rendering (Notion-style, applied to statuses and options alike)

One `<Chip>` component: soft tinted background, foreground from the same hue at full strength, radius 6px (or full for status dots), 12px medium text, 4px gap, optional 14px icon or emoji on the left, no drop shadow, no gradient. Height 22px inline in tables, 26px in detail sheets. Truncate long labels with a tooltip, never wrap inside a table cell.

Colors come from a fixed chip palette defined in tokens — around 10 hues (slate, red, orange, amber, green, teal, blue, indigo, violet, pink), each with a dark-theme and light-theme pair, all verified at 4.5:1. Options and statuses draw from the same palette so the app reads as one language.

Icons: lucide by default; allow an emoji as an alternative for user-created options (teams love this and it costs nothing).
