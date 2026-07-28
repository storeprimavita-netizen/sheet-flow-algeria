"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { Tables } from "@/lib/supabase/database.types";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CategorySelect } from "@/components/fields/category-select";
import { DateField } from "@/components/fields/date-field";
import { EnumSelect } from "@/components/fields/enum-select";
import { MoneyCurrencyField } from "@/components/fields/money-currency-field";
import { ProductCombobox } from "@/components/fields/comboboxes";
import { EXPENSE_CATEGORIES, type CURRENCY_CODES } from "@/lib/enums";
import { saveExpense } from "@/app/app/products/actions";

type ExpenseRow = Tables<"expenses">;
type CurrencyCode = (typeof CURRENCY_CODES)[number];

/**
 * The one expense create/edit form (interconnection Rule 1) — used on the
 * product Expenses tab (product pre-filled + locked) and Finance → Expenses
 * (product chosen via combobox). Posts through the shared `saveExpense` action.
 */
export function ExpenseForm({
  expense,
  productId,
  products,
  suppliers,
  contactId,
  rates,
  onDone,
}: {
  expense?: ExpenseRow;
  productId?: string;
  products?: { id: string; name: string; image?: string | null; status?: string | null }[];
  suppliers: { id: string; name: string }[];
  contactId?: string;
  rates: { USD: number; EUR: number };
  onDone?: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await saveExpense(new FormData(e.currentTarget));
    setBusy(false);
    if (res.ok) {
      toast.success(t("common.updated"));
      router.refresh();
      onDone?.();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="id" value={expense?.id ?? ""} />
      {productId ? <input type="hidden" name="product_id" value={productId} /> : null}
      {contactId ? <input type="hidden" name="contact_id" value={contactId} /> : null}

      {!productId ? (
        <Field label={t("fields.product")} hint={t("common.optional")}>
          <ProductCombobox
            name="product_id"
            products={products ?? []}
            value={expense?.product_id ?? undefined}
            placeholder={t("fields.product")}
          />
        </Field>
      ) : null}

      <Field label={t("fields.category")}>
        <CategorySelect name="category" defaultValue={expense?.category ?? EXPENSE_CATEGORIES[0]} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <MoneyCurrencyField
          defaultAmount={expense?.amount ?? 0}
          defaultCurrency={(expense?.currency as CurrencyCode) ?? "DZD"}
          rates={rates}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("fields.incurred_on")}>
          <DateField name="spent_on" defaultValue={expense?.spent_on ?? today} />
        </Field>
        {!contactId ? (
          <Field label={t("fields.supplier")} hint={t("common.optional")}>
            <EnumSelect
              name="contact_id"
              defaultValue={expense?.contact_id ?? "__none"}
              options={[{ value: "__none", label: t("fields.none") }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
        ) : null}
      </div>

      <Field label={t("fields.notes")} hint={t("common.optional")}>
        <Input name="note" defaultValue={expense?.note ?? ""} />
      </Field>

      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            {t("actions.cancel")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("actions.saving") : expense ? t("actions.save") : t("actions.create")}
        </Button>
      </div>
    </form>
  );
}
