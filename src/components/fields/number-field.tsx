"use client";

import * as React from "react";

/** Empty (or ".") -> null ("inherit"); malformed text ("1.2.3") -> NaN so callers can flag it, never null. */
export function parseNumberInput(text: string): number | null {
  if (text === "" || text === "." || text === "-") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Integer mode: keep the digits before the decimal point; what follows is dropped, digits are never joined. */
export function integerInput(raw: string): string {
  return raw.split(".")[0].replace(/[^\d]/g, "");
}

/**
 * Plain non-negative number input with an optional unit suffix. Empty reports
 * `null` (never 0) so callers can mean "inherit". Uncontrolled: remount with a
 * `key` to reset it.
 */
export function NumberField({
  id,
  name,
  defaultValue,
  unit,
  placeholder,
  disabled,
  invalid,
  describedBy,
  className,
  integer,
  allowNegative,
  onChange,
  "aria-label": ariaLabel,
}: {
  id?: string;
  name?: string;
  defaultValue?: number | null;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  /** whole numbers only (DZD prices) */
  integer?: boolean;
  /** one leading minus sign allowed (price deltas) */
  allowNegative?: boolean;
  onChange?: (value: number | null) => void;
  "aria-label"?: string;
}) {
  const [value, setValue] = React.useState(defaultValue == null ? "" : String(defaultValue));
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
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const raw = e.target.value;
          const neg = allowNegative && raw.trimStart().startsWith("-") ? "-" : "";
          const clean = neg + (integer ? integerInput(raw) : raw.replace(/[^\d.]/g, ""));
          setValue(clean);
          onChange?.(parseNumberInput(clean));
        }}
        className={`num flex h-9 w-full rounded-md border border-input bg-transparent py-1 ps-3 text-end text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive ${unit ? "pe-10" : "pe-3"}`}
      />
      {unit ? (
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
