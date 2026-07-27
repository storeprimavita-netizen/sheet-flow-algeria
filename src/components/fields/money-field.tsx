"use client";

import * as React from "react";

import type { CURRENCY_CODES } from "@/lib/enums";

type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** "1 234 567" — space thousands separators, no decimals unless < 100. */
function groupDigits(n: number): string {
  const decimals = Math.abs(n) < 100 && !Number.isInteger(n) ? 2 : 0;
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals }).replace(/,/g, " ");
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Money input: right-aligned tabular, live thousands separators, currency
 * suffix, no spinner arrows, tolerates pasted spaces. For USD/EUR shows the
 * live DZD conversion beneath. Posts the plain number via a hidden `name`.
 */
export function MoneyField({
  name,
  defaultValue = 0,
  currency = "DZD",
  rate = 1,
  disabled,
  className,
  id,
}: {
  name?: string;
  defaultValue?: number;
  currency?: CurrencyCode;
  /** DZD per 1 unit of `currency` (ignored for DZD) */
  rate?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const [value, setValue] = React.useState(defaultValue);
  const [display, setDisplay] = React.useState(defaultValue ? groupDigits(defaultValue) : "");

  const dzd = currency === "DZD" ? value : value * rate;

  return (
    <div className={className}>
      <div className="relative">
        {name ? <input type="hidden" name={name} value={value} /> : null}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          dir="ltr"
          disabled={disabled}
          value={display}
          onChange={(e) => {
            const n = parseAmount(e.target.value);
            setValue(n);
            setDisplay(e.target.value);
          }}
          onBlur={() => setDisplay(value ? groupDigits(value) : "")}
          className="num flex h-9 w-full rounded-md border border-input bg-transparent py-1 pe-12 ps-3 text-end text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
          {currency === "DZD" ? "DA" : currency}
        </span>
      </div>
      {currency !== "DZD" ? (
        <p className="mt-1 text-xs text-muted-foreground">
          ≈ <span className="num">{groupDigits(dzd)}</span> DA{" "}
          <span className="text-faint">at {rate}</span>
        </p>
      ) : null}
    </div>
  );
}
