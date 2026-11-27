"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { algiersToday } from "@/lib/ledger";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField } from "@/components/fields/date-field";
import { EnumSelect } from "@/components/fields/enum-select";
import { NumberField } from "@/components/fields/number-field";
import { OptionSelect, type Option } from "@/components/fields/option-select";
import { saveEntry } from "@/app/(app)/app/money/accounts/actions";
import { useLedgerSubmit } from "./use-ledger-submit";

export function LedgerQuickAdd({
  accounts,
  categories,
  initialAccountId,
}: {
  accounts: { id: string; name: string; currency: string }[];
  categories: Option[];
  initialAccountId?: string;
}) {
  const t = useTranslations("accounts.quickAdd");
  const id = React.useId();
  const { busy, submit } = useLedgerSubmit();
  const [accountId, setAccountId] = React.useState(
    () => (accounts.find((a) => a.id === initialAccountId) ?? accounts[0])?.id ?? "",
  );
  const [date, setDate] = React.useState(() => algiersToday());
  const [direction, setDirection] = React.useState<"in" | "out">("out");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [category, setCategory] = React.useState("");
  const [note, setNote] = React.useState("");
  const [round, setRound] = React.useState(0);
  // Follow the ledger filter without remounting (typed input and the retry key survive),
  // but never move a half-typed amount to another account.
  const [followed, setFollowed] = React.useState(initialAccountId);
  if (followed !== initialAccountId) {
    setFollowed(initialAccountId);
    if (amount === null && accounts.some((a) => a.id === initialAccountId)) setAccountId(initialAccountId!);
  }
  const currency = accounts.find((a) => a.id === accountId)?.currency;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = {
      account_id: accountId,
      occurred_on: date,
      direction,
      amount: amount ?? 0,
      category_id: category || undefined,
      note: note.trim() || undefined,
    };
    submit(input, (request_key) => saveEntry({ ...input, request_key }), () => {
      setAmount(null);
      setCategory("");
      setNote("");
      setRound((n) => n + 1);
    });
  }

  return (
    <section id="quick-add" className="card-surface scroll-mt-20 space-y-3 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("title")}</h2>
      {accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noAccounts")}</p>
      ) : (
        <form onSubmit={onSubmit} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("account")} htmlFor={`${id}-account`}>
            <EnumSelect id={`${id}-account`} value={accountId} onChange={setAccountId}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))} />
          </Field>
          <Field label={t("date")} htmlFor={`${id}-date`}>
            <DateField id={`${id}-date`} value={date} onChange={setDate} />
          </Field>
          <Field label={t("direction")} htmlFor={`${id}-direction`}>
            <EnumSelect id={`${id}-direction`} value={direction} onChange={(v) => setDirection(v === "in" ? "in" : "out")}
              options={[{ value: "in", label: t("in") }, { value: "out", label: t("out") }]} />
          </Field>
          <Field label={t("amount")} htmlFor={`${id}-amount`}>
            <NumberField key={round} id={`${id}-amount`} unit={currency === "DZD" ? "DA" : currency} onChange={setAmount} />
          </Field>
          <Field label={t("category")}>
            <OptionSelect key={round} setKey="money_category" options={categories} value={category || undefined}
              onChange={setCategory} placeholder={t("categoryPlaceholder")} />
          </Field>
          <Field label={t("note")} htmlFor={`${id}-note`}>
            <Input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} autoComplete="off" />
          </Field>
          <Button type="submit" className="sm:col-start-2 lg:col-start-3" disabled={busy || !amount || !date}>
            {busy ? t("saving") : t("submit")}
          </Button>
        </form>
      )}
    </section>
  );
}
