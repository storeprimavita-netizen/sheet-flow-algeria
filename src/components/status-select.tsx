"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { StatusPill } from "@/components/status-pill";
import { useStatusLabel } from "@/components/status-labels-provider";
import { getStatus, statusOptionsFor, type StatusKind } from "@/lib/statuses";

/**
 * Status change control: pill in the trigger and in every option. For
 * confirmation/delivery (Phase 14a: free status changes within role) every
 * status of the kind is offered, not just `next[]`; other kinds (task,
 * product) still keep their transition graph. `requiresConfirm` statuses
 * (e.g. cancelled/returned) confirm before applying. Posts via `name` inside
 * a plain form.
 */
export function StatusSelect({
  kind,
  value,
  onChange,
  name,
  disabled,
  className,
  compact,
}: {
  kind: StatusKind;
  value: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
  /** icon + short label, for tight table columns */
  compact?: boolean;
}) {
  const t = useTranslations();
  const statusLabel = useStatusLabel();
  const [current, setCurrent] = React.useState(value);
  const options = statusOptionsFor(kind, current);

  function handleChange(v: string) {
    const def = getStatus(kind, v);
    if (def?.requiresConfirm && !window.confirm(t("orders.confirmStatus", { status: statusLabel(kind, v, t(def.label)) }))) return;
    setCurrent(v);
    onChange?.(v);
  }

  return (
    <Select
      value={current}
      onValueChange={handleChange}
      name={name}
      disabled={disabled}
    >
      <SelectTrigger className={className}>
        <StatusPill kind={kind} status={current} size="sm" compact={compact} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.key} value={o.key}>
            <StatusPill kind={kind} status={o.key} size="sm" compact={compact} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
