import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/enums";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CurrencyRateFields } from "@/components/currency-rate-fields";
import { DeleteButton } from "@/components/delete-button";
import { saveExpense } from "../../actions";

export default async function ProductExpensesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const profile = (await getProfile())!;

  const supabase = await createClient();
  const [{ data: product }, { data: expenses }, { data: suppliers }, usdRate, eurRate] = await Promise.all([
    supabase.from("products").select("id").eq("id", id).maybeSingle(),
    supabase.from("expenses").select("*").eq("product_id", id).order("spent_on", { ascending: false }),
    supabase.from("contacts").select("id, name").order("name"),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
  ]);
  if (!product) notFound();

  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <section className="glass-card space-y-4 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("expenses.title")}</h2>

        {!expenses?.length ? (
          <p className="text-sm text-muted-foreground">{t("expenses.none")}</p>
        ) : (
          <div className="space-y-3">
            {expenses.map((e) => (
              <form
                key={e.id}
                action={saveExpense.bind(null, e.id, id)}
                className="grid grid-cols-2 items-end gap-2 border-b border-border pb-3 sm:grid-cols-7"
              >
                <Field label={t("fields.category")}>
                  <Select name="category" defaultValue={e.category}>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`status.expense_category.${c}`)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={t("fields.amount")}>
                  <Input name="amount" type="number" step="0.01" min="0" required defaultValue={e.amount} />
                </Field>
                <CurrencyRateFields defaultCurrency={e.currency} defaultRate={e.fx_rate} rates={rates} />
                <Field label={t("fields.incurred_on")}>
                  <Input name="spent_on" type="date" required defaultValue={e.spent_on} />
                </Field>
                <Field label={t("fields.supplier")} hint={t("common.optional")}>
                  <Select name="contact_id" defaultValue={e.contact_id ?? ""}>
                    <option value="">{t("fields.none")}</option>
                    {(suppliers ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex gap-2 sm:col-span-7">
                  <Field label={t("fields.notes")} hint={t("common.optional")} className="grow">
                    <Input name="note" defaultValue={e.note ?? ""} />
                  </Field>
                  <Badge variant="outline" className="self-center">
                    {formatCurrency(e.amount_dzd)}
                  </Badge>
                  <Button type="submit" size="sm" className="self-end">
                    {t("actions.save")}
                  </Button>
                  <DeleteButton table="expenses" id={e.id} redirectTo={`/app/products/${id}/expenses`} className="self-end" />
                </div>
              </form>
            ))}
          </div>
        )}

        <form
          action={saveExpense.bind(null, null, id)}
          className="grid grid-cols-2 items-end gap-2 border-t border-border pt-4 sm:grid-cols-7"
        >
          <Field label={t("fields.category")}>
            <Select name="category" defaultValue={EXPENSE_CATEGORIES[0]}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`status.expense_category.${c}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.amount")}>
            <Input name="amount" type="number" step="0.01" min="0" required />
          </Field>
          <CurrencyRateFields defaultCurrency="DZD" defaultRate={1} rates={rates} />
          <Field label={t("fields.incurred_on")}>
            <Input name="spent_on" type="date" required defaultValue={today} />
          </Field>
          <Field label={t("fields.supplier")} hint={t("common.optional")}>
            <Select name="contact_id" defaultValue="">
              <option value="">{t("fields.none")}</option>
              {(suppliers ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.notes")} hint={t("common.optional")} className="sm:col-span-2">
            <Input name="note" />
          </Field>
          <Button type="submit" size="sm">
            {t("actions.create")}
          </Button>
        </form>
      </section>
    </div>
  );
}
