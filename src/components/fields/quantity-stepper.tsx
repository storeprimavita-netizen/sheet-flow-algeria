"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** − n + quantity control. Posts the number via `name`. */
export function QuantityStepper({
  name,
  defaultValue = 1,
  min = 1,
  max = 9999,
  disabled,
}: {
  name?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const [value, setValue] = React.useState(defaultValue);
  const set = (n: number) => setValue(Math.min(max, Math.max(min, n)));

  return (
    <div className="inline-flex items-center rounded-md border border-input">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-e-none"
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
        aria-label={t("actions.decrease")}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <input
        type="text"
        inputMode="numeric"
        dir="ltr"
        disabled={disabled}
        value={value}
        onChange={(e) => set(Number(e.target.value.replace(/\D/g, "")) || min)}
        className="num h-9 w-12 border-x border-input bg-transparent text-center text-sm focus-visible:outline-none"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-s-none"
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
        aria-label={t("actions.increase")}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
