import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { formatDate } from "@/lib/format";
import { algiersToday } from "@/lib/ledger";
import { Field, tableClass } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { EnumSelect } from "@/components/fields/enum-select";
import { NumberField } from "@/components/fields/number-field";
import { DateField } from "@/components/fields/date-field";
import { addExchangeRate } from "./actions";

export async function ExchangeRatesSection({
  rates,
  current,
}: {
  rates: Tables<"exchange_rates">[];
  current: { USD: number | null; EUR: number | null; USDT: number | null };
}) {
  const t = await getTranslations();
  const today = algiersToday();

  return (
    <section id="exchange-rates" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.exchangeRates")}</h2>

      <div className="grid grid-cols-1 gap-3 sm:max-w-md sm:grid-cols-3">
        {(["USD", "EUR", "USDT"] as const).map((c) => (
          <Card key={c}>
            <CardHeader className="gap-1 p-4">
              <CardDescription>{c} → DZD</CardDescription>
              <CardTitle className="num text-lg">{current[c] ? current[c] : "—"}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <form action={addExchangeRate} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
        <Field label={t("fields.currency")}>
          <EnumSelect
            name="currency"
            defaultValue="USD"
            options={[
              { value: "USD", label: "USD" },
              { value: "EUR", label: "EUR" },
              { value: "USDT", label: "USDT" },
            ]}
          />
        </Field>
        <Field label={t("settings.rate")}>
          <NumberField name="rate_dzd" unit="DA" />
        </Field>
        <Field label={t("settings.validFrom")}>
          <DateField name="valid_from" defaultValue={today} />
        </Field>
        <Button type="submit">{t("actions.create")}</Button>
      </form>

      {rates.length ? (
        <div className="max-h-64 overflow-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>{t("fields.currency")}</th>
                <th>{t("settings.rate")}</th>
                <th>{t("settings.validFrom")}</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id}>
                  <td>{r.currency}</td>
                  <td className="num">{r.rate_dzd}</td>
                  <td className="text-muted-foreground">{formatDate(r.valid_from)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("settings.noRates")}</p>
      )}
    </section>
  );
}
