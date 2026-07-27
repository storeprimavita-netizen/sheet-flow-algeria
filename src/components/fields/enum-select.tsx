"use client";

import * as React from "react";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/**
 * Radix Select for a **fixed system enum** (product status, currency, stock
 * reason, ad kind…) — the design-system replacement for native `<select>`.
 * User-extensible taxonomies use `OptionSelect` instead (see option-sets.md).
 * Uncontrolled (name + defaultValue) posts inside a plain form; pass
 * value+onChange to control it. Radix can't take an empty value — map a
 * sentinel in the caller when "none" is a choice.
 */
export function EnumSelect({
  name,
  options,
  value,
  defaultValue,
  onChange,
  placeholder,
  disabled,
  className,
  id,
}: {
  name?: string;
  options: { value: string; label: React.ReactNode }[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <Select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onChange}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
