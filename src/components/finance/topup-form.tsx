"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/fields/date-field";
import { saveTopup } from "@/app/(app)/app/finance/accounts/actions";

export function TopupForm({ accountId, onDone }: { accountId: string; onDone?: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await saveTopup(new FormData(e.currentTarget));
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
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="account_id" value={accountId} />

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("accounts.topup.amount")}>
          <Input name="amount" type="number" step="0.01" min="0.01" required />
        </Field>
        <Field label={t("accounts.topup.occurredOn")}>
          <DateField name="occurred_on" defaultValue={today} />
        </Field>
      </div>

      <Field label={t("accounts.topup.note")} hint={t("common.optional")}>
        <Input name="note" />
      </Field>

      <div className="flex justify-end gap-2">
        {onDone ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            {t("actions.cancel")}
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? t("actions.saving") : t("accounts.topup.title")}
        </Button>
      </div>
    </form>
  );
}
