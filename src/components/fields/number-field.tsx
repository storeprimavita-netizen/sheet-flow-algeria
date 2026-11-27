"use client";

import * as React from "react";

import { groupDigits } from "@/lib/format";

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

/** Reads the whole typed text. A comma is the decimal mark (French/Arabic keyboards)
 * unless the text is clearly thousands-grouped. A single comma before three digits
 * ("1,000") could mean 1 or 1000, so it is returned unchanged and parses as NaN:
 * a money field must never turn what was typed into another valid amount. */
export function decimalInput(text: string): string {
  if (!text.includes(",")) return text;
  const commas = text.split(",").length - 1;
  const grouped = /^-?[1-9]\d{0,2}(,\d{3})+(\.\d*)?$/.test(text);
  if (grouped) return commas > 1 || text.includes(".") ? text.replace(/,/g, "") : text;
  return commas === 1 && !text.includes(".") ? text.replace(",", ".") : text;
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
  group,
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
  /** show thousands separators while the field is not being edited */
  group?: boolean;
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
  const [focused, setFocused] = React.useState(false);
  const normalized = decimalInput(value);
  // With a comma on screen, the form posts the interpreted number instead of the text.
  const comma = value.includes(",");
  return (
    <div className={`relative ${className ?? ""}`}>
      <input
        id={id}
        name={comma ? undefined : name}
        type="text"
        inputMode="decimal"
        dir="ltr"
        disabled={disabled}
        value={group && !focused && !normalized.includes(",") ? groupDigits(normalized) : value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-invalid={invalid || Number.isNaN(parseNumberInput(normalized)) || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          const raw = e.target.value;
          const neg = allowNegative && raw.trimStart().startsWith("-") ? "-" : "";
          const clean = neg + (integer ? integerInput(raw) : raw.replace(/[^\d.,]/g, ""));
          setValue(clean);
          onChange?.(parseNumberInput(decimalInput(clean)));
        }}
        className={`num flex h-9 w-full rounded-md border border-input bg-transparent py-1 ps-3 text-end text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive ${unit ? (unit.length > 3 ? "pe-14" : "pe-10") : "pe-3"}`}
      />
      {comma && name ? <input type="hidden" name={name} value={normalized} /> : null}
      {unit ? (
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
