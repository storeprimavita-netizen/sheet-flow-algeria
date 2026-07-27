import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { formatDate } from "@/lib/format";
import { Field, tableClass } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { addExchangeRate } from "./actions";

export async function ExchangeRatesSection({
  rates,
  current,
}: {
  rates: Tables<"exchange_rates">[];
  current: { USD: number | null; EUR: number | null };
}) {
  const t = await getTranslations();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="card-surface space-y-4 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.exchangeRates")}</h2>

      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        {(["USD", "EUR"] as const).map((c) => (
          <Card key={c}>
            <CardHeader className="gap-1 p-4">
              <CardDescription>{c} → DZD</CardDescription>
              <CardTitle className="text-lg">{current[c] ? current[c] : "—"}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <form action={addExchangeRate} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
        <Field label={t("fields.currency")}>
          <Select name="currency" defaultValue="USD">
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </Select>
        </Field>
        <Field label={t("settings.rate")}>
          <Input name="rate_dzd" type="number" step="0.0001" min="0" required />
        </Field>
        <Field label={t("settings.validFrom")}>
          <Input name="valid_from" type="date" defaultValue={today} />
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
                  <td>{r.rate_dzd}</td>
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
