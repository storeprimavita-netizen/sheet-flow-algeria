"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const dateCls =
  "num flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:inherit]";

/** Native date input (picker + typed entry), styled to tokens. ISO value. */
export function DateField({
  name,
  defaultValue,
  value,
  onChange,
  disabled,
  className,
  id,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="date"
      name={name}
      defaultValue={value === undefined ? defaultValue : undefined}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      disabled={disabled}
      className={cn(dateCls, className)}
    />
  );
}

/** Native time input (`HH:MM`), styled to tokens — same treatment as `DateField`. */
export function TimeField({
  name,
  defaultValue,
  disabled,
  className,
  id,
}: {
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="time"
      name={name}
      defaultValue={defaultValue}
      disabled={disabled}
      className={cn(dateCls, className)}
    />
  );
}

function iso(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

const PRESETS: { key: string; label: string; range: () => [string, string] }[] = [
  { key: "today", label: "Today", range: () => [iso(new Date()), iso(new Date())] },
  {
    key: "yesterday",
    label: "Yesterday",
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return [iso(d), iso(d)];
    },
  },
  {
    key: "last7",
    label: "Last 7 days",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return [iso(from), iso(to)];
    },
  },
  {
    key: "last30",
    label: "Last 30 days",
    range: () => {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return [iso(from), iso(to)];
    },
  },
  {
    key: "month",
    label: "This month",
    range: () => {
      const now = new Date();
      return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)];
    },
  },
  {
    key: "lastMonth",
    label: "Last month",
    range: () => {
      const now = new Date();
      return [
        iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
        iso(new Date(now.getFullYear(), now.getMonth(), 0)),
      ];
    },
  },
];

/** Date range with presets. Posts `${name}From` / `${name}To`. */
export function DateRangeField({
  name = "date",
  defaultFrom = "",
  defaultTo = "",
}: {
  name?: string;
  defaultFrom?: string;
  defaultTo?: string;
}) {
  const [from, setFrom] = React.useState(defaultFrom);
  const [to, setTo] = React.useState(defaultTo);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const [f, t] = p.range();
              setFrom(f);
              setTo(t);
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <DateField name={`${name}From`} value={from} onChange={setFrom} />
        <span className="text-muted-foreground">–</span>
        <DateField name={`${name}To`} value={to} onChange={setTo} />
      </div>
    </div>
  );
}
