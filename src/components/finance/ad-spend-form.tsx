"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { AD_KINDS } from "@/lib/enums";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/fields/date-field";
import { EnumSelect } from "@/components/fields/enum-select";
import { MoneyCurrencyField } from "@/components/fields/money-currency-field";
import { ProductCombobox } from "@/components/fields/comboboxes";
import { upsertAdSpend } from "@/app/app/products/actions";

/**
 * Shared daily ad-spend quick entry (interconnection Rule 1) — product page
 * (product pre-filled) and Finance → Ad spend. Posts via the shared
 * `upsertAdSpend` action (upsert on workspace+product+date+kind).
 */
export function AdSpendForm({
  productId,
  products,
  rates,
  className,
}: {
  productId?: string;
  products?: { id: string; name: string; image?: string | null; status?: string | null }[];
  rates: { USD: number; EUR: number };
  className?: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await upsertAdSpend(new FormData(e.currentTarget));
    setBusy(false);
    if (res.ok) {
      toast.success(t("common.updated"));
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className={className ?? "card-surface space-y-4 rounded-xl p-5"}>
      <h2 className="text-sm font-semibold">{t("products.adSpend")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {productId ? (
          <input type="hidden" name="product_id" value={productId} />
        ) : (
          <Field label={t("fields.product")}>
            <ProductCombobox name="product_id" products={products ?? []} placeholder={t("fields.product")} />
          </Field>
        )}
        <Field label={t("fields.incurred_on")}>
          <DateField name="spent_on" defaultValue={today} />
        </Field>
        <Field label={t("fields.kind")}>
          <EnumSelect
            name="kind"
            defaultValue="test"
            options={AD_KINDS.map((k) => ({ value: k, label: t(`status.ad_kind.${k}`) }))}
          />
        </Field>
        <MoneyCurrencyField defaultCurrency="EUR" rates={rates} />
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? t("actions.saving") : t("actions.save")}
      </Button>
    </form>
  );
}
