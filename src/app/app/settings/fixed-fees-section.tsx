import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { CURRENCY_CODES } from "@/lib/enums";
import { formatCurrency } from "@/lib/format";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { saveFixedFee, deleteFixedFee } from "./actions";

export async function FixedFeesSection({ fees }: { fees: Tables<"fixed_fees">[] }) {
  const t = await getTranslations();
  const currencyOptions = CURRENCY_CODES.map((c) => (
    <option key={c} value={c}>
      {c}
    </option>
  ));

  return (
    <section className="glass-card space-y-4 rounded-xl p-5">
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
              <Field label={t("fields.amount")}>
                <Input name="amount" type="number" step="0.01" min="0" required defaultValue={f.amount} />
              </Field>
              <Field label={t("fields.currency")}>
                <Select name="currency" defaultValue={f.currency}>
                  {currencyOptions}
                </Select>
              </Field>
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
        <Field label={t("fields.amount")}>
          <Input name="amount" type="number" step="0.01" min="0" required />
        </Field>
        <Field label={t("fields.currency")}>
          <Select name="currency" defaultValue="DZD">
            {currencyOptions}
          </Select>
        </Field>
        <div />
        <Button type="submit" size="sm">
          {t("actions.create")}
        </Button>
      </form>
    </section>
  );
}
