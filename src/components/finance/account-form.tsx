"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/fields/number-field";
import { SettingSwitch } from "@/components/fields/setting-switch";
import { saveAccount } from "@/app/(app)/app/money/accounts/actions";
import { useLedgerSubmit } from "./use-ledger-submit";

/** Name, low-balance threshold and active flag: the only editable account settings. */
export function AccountForm({
  account,
  onDone,
}: {
  account: { id: string; name: string; low_balance_threshold: number; is_active: boolean };
  onDone: () => void;
}) {
  const t = useTranslations();
  const id = React.useId();
  const { busy, submit } = useLedgerSubmit();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("id", account.id);
    submit(null, () => saveAccount(data), onDone);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label={t("accounts.fields.name")} htmlFor={`${id}-name`}>
        <Input id={`${id}-name`} name="name" defaultValue={account.name} required autoComplete="off" />
      </Field>
      <Field label={t("accounts.fields.lowBalanceThreshold")} htmlFor={`${id}-threshold`} hint={t("accounts.fields.thresholdHint")}>
        <NumberField id={`${id}-threshold`} name="low_balance_threshold" defaultValue={account.low_balance_threshold} />
      </Field>
      <SettingSwitch name="is_active" label={t("accounts.fields.isActive")} defaultChecked={account.is_active} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          {t("actions.cancel")}
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("actions.saving") : t("actions.save")}
        </Button>
      </div>
    </form>
  );
}
