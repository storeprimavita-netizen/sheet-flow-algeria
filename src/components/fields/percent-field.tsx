"use client";

import * as React from "react";

/** Percent input: `%` suffix, clamps 0–100 on blur, tabular. Posts via `name`. */
export function PercentField({
  name,
  defaultValue,
  disabled,
  className,
  id,
  onChange,
}: {
  name?: string;
  defaultValue?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** fires on user input with the numeric value (0 for empty) */
  onChange?: (value: number) => void;
}) {
  const [value, setValue] = React.useState(defaultValue?.toString() ?? "");

  function clamp() {
    if (value === "") return;
    const n = Math.min(100, Math.max(0, Number(value) || 0));
    setValue(String(Math.round(n * 10) / 10));
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        dir="ltr"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const clean = e.target.value.replace(/[^\d.]/g, "");
          setValue(clean);
          onChange?.(Number(clean) || 0);
        }}
        onBlur={clamp}
        className="num flex h-9 w-full rounded-md border border-input bg-transparent py-1 pe-8 ps-3 text-end text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
        %
      </span>
    </div>
  );
}
