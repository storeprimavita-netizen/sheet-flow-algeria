import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { formatCurrency } from "@/lib/format";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoneyCurrencyField } from "@/components/fields/money-currency-field";
import { saveFixedFee, deleteFixedFee } from "./actions";

export async function FixedFeesSection({
  fees,
  rates,
}: {
  fees: Tables<"fixed_fees">[];
  rates: { USD: number; EUR: number };
}) {
  const t = await getTranslations();

  return (
    <section id="fixed-fees" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.fixedFees")}</h2>

      {!fees.length ? (
        <p className="text-sm text-muted-foreground">{t("settings.noFixedFees")}</p>
      ) : (
        <div className="space-y-3">
          {fees.map((f) => (
            <form
              key={f.id}
              action={saveFixedFee.bind(null, f.id)}
              className="grid grid-cols-2 items-end gap-2 border-b border-border pb-3 sm:grid-cols-6"
            >
              <Field label={t("fields.label")} className="sm:col-span-2">
                <Input name="label" required defaultValue={f.label} />
              </Field>
              <MoneyCurrencyField defaultAmount={f.amount} defaultCurrency={f.currency} rates={rates} />
              <div className="text-sm text-muted-foreground">{formatCurrency(f.amount_dzd)}</div>
              <div className="flex gap-2">
                <Button type="submit" size="sm">
                  {t("actions.save")}
                </Button>
                <Button type="submit" formAction={deleteFixedFee.bind(null, f.id)} variant="destructive" size="sm">
                  {t("actions.delete")}
                </Button>
              </div>
            </form>
          ))}
        </div>
      )}

      <form action={saveFixedFee.bind(null, null)} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
        <Field label={t("fields.label")} className="sm:col-span-2">
          <Input name="label" required />
        </Field>
        <MoneyCurrencyField rates={rates} />
        <div />
        <Button type="submit" size="sm">
          {t("actions.create")}
        </Button>
      </form>
    </section>
  );
}
