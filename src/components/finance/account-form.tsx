"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EnumSelect } from "@/components/fields/enum-select";
import { saveAccount } from "@/app/(app)/app/money/accounts/actions";
import { CURRENCY_CODES } from "@/lib/enums";

type AccountRow = {
  id?: string;
  name: string;
  currency: string;
  opening_balance: number;
  low_balance_threshold: number;
  is_active: boolean;
};

export function AccountForm({
  account,
  onDone,
}: {
  account?: AccountRow;
  onDone?: () => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await saveAccount(new FormData(e.currentTarget));
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
      <input type="hidden" name="id" value={account?.id ?? ""} />

      <Field label={t("accounts.fields.name")}>
        <Input name="name" defaultValue={account?.name ?? ""} required />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("accounts.fields.currency")}>
          <EnumSelect
            name="currency"
            defaultValue={account?.currency ?? "DZD"}
            options={CURRENCY_CODES.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label={t("accounts.fields.openingBalance")}>
          <Input name="opening_balance" type="number" step="0.01" min="0" defaultValue={account?.opening_balance ?? 0} />
        </Field>
      </div>

      <Field label={t("accounts.fields.lowBalanceThreshold")}>
        <Input name="low_balance_threshold" type="number" step="0.01" min="0" defaultValue={account?.low_balance_threshold ?? 0} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_active" defaultChecked={account?.is_active ?? true} className="rounded" />
        {t("accounts.fields.isActive")}
      </label>

      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            {t("actions.cancel")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("actions.saving") : account ? t("actions.save") : t("actions.create")}
        </Button>
      </div>
    </form>
  );
}
