"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { Tables } from "@/lib/supabase/database.types";
import { AD_KINDS, type CURRENCY_CODES } from "@/lib/enums";
import { formatDate } from "@/lib/format";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/fields/date-field";
import { EnumSelect } from "@/components/fields/enum-select";
import { MoneyCurrencyField } from "@/components/fields/money-currency-field";
import { ProductCombobox } from "@/components/fields/comboboxes";
import { upsertAdSpend } from "@/app/(app)/app/products/actions";

type AdSpendRow = Tables<"ad_spend_daily">;
type CurrencyCode = (typeof CURRENCY_CODES)[number];

/**
 * Shared daily ad-spend entry (interconnection Rule 1) — quick-add on the
 * product page/Finance → Ad spend, and editing an existing row from
 * `<AdSpendTable>`. Posts via the shared `upsertAdSpend` action (upsert on
 * workspace+product+date+kind). Editing keeps date/kind locked to their
 * original values — changing them would upsert a NEW row under a different
 * conflict key instead of updating this one, leaving a stale duplicate.
 */
export function AdSpendForm({
  productId,
  products,
  rates,
  accounts,
  className,
  defaultValues,
  onDone,
}: {
  productId?: string;
  products?: { id: string; name: string; image?: string | null; status?: string | null }[];
  rates: { USD: number; EUR: number };
  accounts?: { id: string; name: string }[];
  className?: string;
  defaultValues?: AdSpendRow;
  onDone?: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const locked = !!defaultValues;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await upsertAdSpend(new FormData(e.currentTarget));
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
    <form onSubmit={onSubmit} className={className ?? "card-surface space-y-4 rounded-xl p-5"}>
      {!locked ? <h2 className="text-sm font-semibold">{t("products.adSpend")}</h2> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {productId || locked ? (
          <input type="hidden" name="product_id" value={productId ?? defaultValues!.product_id} />
        ) : (
          <Field label={t("fields.product")}>
            <ProductCombobox name="product_id" products={products ?? []} placeholder={t("fields.product")} />
          </Field>
        )}
        {locked ? (
          <>
            <input type="hidden" name="spent_on" value={defaultValues!.spent_on} />
            <input type="hidden" name="kind" value={defaultValues!.kind} />
            <Field label={t("fields.incurred_on")}>
              <p className="num flex h-9 items-center text-sm">{formatDate(defaultValues!.spent_on)}</p>
            </Field>
            <Field label={t("fields.kind")}>
              <p className="flex h-9 items-center text-sm">{t(`status.ad_kind.${defaultValues!.kind}`)}</p>
            </Field>
          </>
        ) : (
          <>
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
          </>
        )}
        <MoneyCurrencyField
          defaultAmount={defaultValues?.amount ?? 0}
          defaultCurrency={(defaultValues?.currency as CurrencyCode) ?? "EUR"}
          rates={rates}
        />
      </div>
      {accounts && accounts.length > 0 ? (
        <Field label={t("accounts.title")} hint={t("common.optional")}>
          <EnumSelect
            name="account_id"
            defaultValue={defaultValues?.account_id ?? "__none"}
            options={[{ value: "__none", label: t("fields.none") }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
          />
        </Field>
      ) : null}
      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            {t("actions.cancel")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("actions.saving") : t("actions.save")}
        </Button>
      </div>
    </form>
  );
}
