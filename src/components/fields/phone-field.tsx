"use client";

import * as React from "react";
import Link from "next/link";
import { UserCheck } from "lucide-react";

import { Input } from "@/components/ui/input";

/** Normalize DZ phone for display: 0X…, +213…, 00213…, bare 9-digit → 0XXXXXXXXX. */
export function normalizeDisplay(raw: string): string {
  let s = raw.replace(/[\s-]/g, "");
  if (s.startsWith("+213")) s = "0" + s.slice(4);
  else if (s.startsWith("00213")) s = "0" + s.slice(5);
  else if (s.startsWith("213")) s = "0" + s.slice(3);
  else if (/^[5-7]\d{8}$/.test(s)) s = "0" + s;
  return s;
}

/**
 * Algerian phone input. Normalizes on blur; posts the normalized value via
 * `name`. `dupHint` (resolved by the parent from customer data) renders an
 * inline "existing customer" link.
 */
export function PhoneField({
  name,
  defaultValue = "",
  disabled,
  className,
  id,
  dupHint,
  onNormalized,
}: {
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  dupHint?: { label: string; href: string } | null;
  onNormalized?: (value: string) => void;
}) {
  const [value, setValue] = React.useState(defaultValue);

  return (
    <div className={className}>
      <Input
        id={id}
        name={name}
        type="tel"
        dir="ltr"
        inputMode="tel"
        disabled={disabled}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const n = normalizeDisplay(value);
          setValue(n);
          onNormalized?.(n);
        }}
        className="num"
        placeholder="0555 12 34 56"
      />
      {dupHint ? (
        <Link
          href={dupHint.href}
          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-info hover:underline"
        >
          <UserCheck className="h-3.5 w-3.5" />
          {dupHint.label}
        </Link>
      ) : null}
    </div>
  );
}
