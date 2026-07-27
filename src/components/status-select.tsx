"use client";

import * as React from "react";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { transitionsFor, type StatusKind } from "@/lib/statuses";

/**
 * Status change control: pill in the trigger and in every option, offering only
 * legal transitions (current + next[]). Posts via `name` inside a plain form.
 */
export function StatusSelect({
  kind,
  value,
  onChange,
  name,
  disabled,
  className,
}: {
  kind: StatusKind;
  value: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [current, setCurrent] = React.useState(value);
  const options = transitionsFor(kind, current);

  return (
    <Select
      value={current}
      onValueChange={(v) => {
        setCurrent(v);
        onChange?.(v);
      }}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <StatusPill kind={kind} status={current} size="sm" />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            <StatusPill kind={kind} status={o.key} size="sm" />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
