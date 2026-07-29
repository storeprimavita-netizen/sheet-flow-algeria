"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import type { Role } from "@/lib/roles";
import { EnumSelect } from "@/components/fields/enum-select";

const ROLES: Role[] = ["confirmation_agent", "delivery_agent", "admin"];

/** Role picker + a plain-language description of what the selected role can
 * see (section-checklists.md §Team & Rules), updating live as the choice
 * changes — one shared control for both the invite form and per-row edit. */
export function RoleSelect({
  name,
  defaultValue = "confirmation_agent",
  disabled,
}: {
  name?: string;
  defaultValue?: Role;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const [role, setRole] = React.useState<Role>(defaultValue);

  return (
    <div className="space-y-1.5">
      <EnumSelect
        name={name}
        defaultValue={defaultValue}
        onChange={(v) => setRole(v as Role)}
        disabled={disabled}
        options={ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
      />
      <p className="text-xs text-muted-foreground">{t(`role.descriptions.${role}`)}</p>
    </div>
  );
}
