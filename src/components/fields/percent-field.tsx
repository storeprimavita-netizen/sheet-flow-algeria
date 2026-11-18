"use client";

import * as React from "react";

/** Parse typed text: `nullable` empty -> null, otherwise empty -> 0. */
export function parsePercentInput(text: string, nullable: boolean): number | null {
  return text === "" && nullable ? null : Number(text) || 0;
}

/** Blur normalisation: clamp to 0..max, round to `decimals`. Empty stays empty. */
export function normalizePercent(text: string, max: number, decimals: number): string {
  if (text === "") return "";
  const n = Math.min(max, Math.max(0, Number(text) || 0));
  const f = 10 ** decimals;
  return String(Math.round(n * f) / f);
}

/** What blur must do: the normalised text AND the value to report, or null when nothing changed. */
export function blurChange(
  text: string,
  max: number,
  decimals: number,
  nullable: boolean,
): { text: string; value: number | null } | null {
  const normalized = normalizePercent(text, max, decimals);
  return normalized === text ? null : { text: normalized, value: parsePercentInput(normalized, nullable) };
}

/**
 * Percent input: `%` suffix, tabular, clamps to 0–`max` and rounds to
 * `decimals` on blur. Posts via `name`.
 * - default: max 100, 1 decimal, empty reports 0 (existing callers).
 * - `nullable`: empty stays empty and reports `null` ("inherit"), never 0.
 */
export function PercentField({
  name,
  defaultValue,
  disabled,
  className,
  id,
  onChange,
  max = 100,
  decimals = 1,
  nullable = false,
  placeholder,
  invalid,
  describedBy,
  "aria-label": ariaLabel,
}: {
  name?: string;
  defaultValue?: number | null;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** fires on user input with the numeric value (0 for empty, or null when `nullable`) */
  onChange?: (value: number | null) => void;
  max?: number;
  decimals?: number;
  nullable?: boolean;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  "aria-label"?: string;
}) {
  const [value, setValue] = React.useState(defaultValue == null ? "" : String(defaultValue));

  function clamp() {
    const change = blurChange(value, max, decimals, nullable);
    if (change) {
      setValue(change.text);
      onChange?.(change.value);
    }
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
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const clean = e.target.value.replace(/[^\d.]/g, "");
          setValue(clean);
          onChange?.(parsePercentInput(clean, nullable));
        }}
        onBlur={clamp}
        className="num flex h-9 w-full rounded-md border border-input bg-transparent py-1 pe-8 ps-3 text-end text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive"
      />
      <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
        %
      </span>
    </div>
  );
}
