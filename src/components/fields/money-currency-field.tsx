"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { CURRENCY_CODES } from "@/lib/enums";
import { Field } from "@/components/field";
import { MoneyField } from "@/components/fields/money-field";
import { EnumSelect } from "@/components/fields/enum-select";

type CurrencyCode = (typeof CURRENCY_CODES)[number];

/**
 * Amount + currency picker for a form: `MoneyField` (tabular, live DZD
 * conversion for USD/EUR) beside a currency `EnumSelect`. Posts `amount`,
 * `currency`, and the resolved `fx_rate` (hidden). Switching currency remounts
 * MoneyField with the matching rate so the "≈ … DA" line updates.
 */
export function MoneyCurrencyField({
  amountName = "amount",
  currencyName = "currency",
  rateName = "fx_rate",
  defaultAmount = 0,
  defaultCurrency = "DZD",
  rates,
}: {
  amountName?: string;
  currencyName?: string;
  rateName?: string;
  defaultAmount?: number;
  defaultCurrency?: CurrencyCode;
  rates: { USD: number; EUR: number };
}) {
  const t = useTranslations();
  const [currency, setCurrency] = React.useState<CurrencyCode>(defaultCurrency);
  const rate = currency === "DZD" ? 1 : rates[currency];

  return (
    <>
      <Field label={t("fields.amount")}>
        <MoneyField
          key={currency}
          name={amountName}
          defaultValue={defaultAmount}
          currency={currency}
          rate={rate}
        />
        <input type="hidden" name={rateName} value={rate} />
      </Field>
      <Field label={t("fields.currency")}>
        <EnumSelect
          name={currencyName}
          value={currency}
          onChange={(v) => setCurrency(v as CurrencyCode)}
          options={CURRENCY_CODES.map((c) => ({ value: c, label: c }))}
        />
      </Field>
    </>
  );
}
