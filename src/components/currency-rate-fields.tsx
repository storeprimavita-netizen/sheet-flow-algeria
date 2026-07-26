"use client";

import { useTranslations } from "next-intl";

import { CURRENCY_CODES } from "@/lib/enums";
import { Field } from "@/components/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

/**
 * Currency <select> + fx-rate <input>, wired with plain DOM (no state):
 * switching currency fills the rate from `rates`; the value stays editable.
 */
export function CurrencyRateFields({
  currencyName = "currency",
  rateName = "fx_rate",
  defaultCurrency = "DZD",
  defaultRate = 1,
  rates,
  className,
}: {
  currencyName?: string;
  rateName?: string;
  defaultCurrency?: string;
  defaultRate?: number;
  rates: { USD: number; EUR: number };
  className?: string;
}) {
  const t = useTranslations();

  return (
    <>
      <Field label={t("fields.currency")} htmlFor={currencyName} className={className}>
        <Select
          id={currencyName}
          name={currencyName}
          defaultValue={defaultCurrency}
          onChange={(e) => {
            const form = e.currentTarget.form;
            const input = form?.elements.namedItem(rateName) as HTMLInputElement | null;
            if (!input) return;
            const rate = rates[e.target.value as "USD" | "EUR"];
            input.value = String(rate ?? 1);
          }}
        >
          {CURRENCY_CODES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t("fields.rate")} htmlFor={rateName} className={className}>
        <Input
          id={rateName}
          name={rateName}
          type="number"
          step="0.0001"
          min="0.0001"
          required
          defaultValue={defaultRate}
        />
      </Field>
    </>
  );
}
