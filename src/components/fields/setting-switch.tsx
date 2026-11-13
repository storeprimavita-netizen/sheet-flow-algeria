"use client";

import * as React from "react";

import { Switch } from "@/components/ui/switch";

/** Toggle row: label left, description beneath, switch at the inline-end. */
export function SettingSwitch({
  name,
  label,
  description,
  defaultChecked,
  checked,
  onCheckedChange,
  disabled,
}: {
  name?: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  defaultChecked?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <label htmlFor={id} className="flex items-start justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <Switch
        id={id}
        name={name}
        defaultChecked={defaultChecked}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
      />
    </label>
  );
}
