"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight, HandCoins } from "lucide-react";

import { algiersToday, quoteTransfer, rateFromAmounts, transferAgrees, type TransferFrom } from "@/lib/ledger";
import { formatAccountAmount } from "@/lib/format";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DateField } from "@/components/fields/date-field";
import { EnumSelect } from "@/components/fields/enum-select";
import { NumberField } from "@/components/fields/number-field";
import { markPayoutTaken, transferFunds } from "@/app/(app)/app/money/accounts/actions";
import { useLedgerSubmit } from "./use-ledger-submit";

function MoneyDialog({
  trigger,
  title,
  description,
  disabled,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={disabled}>{trigger}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {/* mounted per opening, so the form starts from current balances and rate */}
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}

/** Held above the dialog content: closing and reopening must keep the request key. */
type Submit = ReturnType<typeof useLedgerSubmit>;

function TransferForm({ rate: latest, close, ledger: { busy, submit } }: { rate: number | null; close: () => void; ledger: Submit }) {
  const t = useTranslations("accounts.transfer");
  const id = React.useId();
  const [from, setFrom] = React.useState<TransferFrom>("DZD");
  const [date, setDate] = React.useState(() => algiersToday());
  const [note, setNote] = React.useState("");
  const [values, setValues] = React.useState<{ out: number | null; rate: number | null; in: number | null }>(
    { out: null, rate: latest, in: null },
  );
  // NumberField is uncontrolled: bump a version to show a computed value.
  const [version, setVersion] = React.useState({ out: 0, rate: 0, in: 0 });

  function quote(side: TransferFrom, out: number | null, rate: number | null) {
    const q = out && rate ? quoteTransfer(side, out, rate) : null;
    // The rate is only nudged when 6 USDT decimals cannot carry what was typed.
    const nudged = q !== null && q.rate !== rate;
    setVersion((v) => ({ ...v, rate: nudged ? v.rate + 1 : v.rate, in: v.in + 1 }));
    setValues({ out, rate: q?.rate ?? rate, in: q?.amountIn ?? null });
  }

  function typedIn(amountIn: number | null) {
    // Without both amounts there is nothing to recompute: the rate stays.
    if (!values.out || !amountIn) return setValues((v) => ({ ...v, in: amountIn }));
    const next = rateFromAmounts(from, values.out, amountIn);
    // No rate links these two: keep the old one, and the mismatch message shows.
    if (next === null) return setValues((v) => ({ ...v, in: amountIn }));
    setValues((v) => ({ ...v, in: amountIn, rate: next }));
    setVersion((v) => ({ ...v, rate: v.rate + 1 }));
  }

  const valid = !!values.out && !!values.in && !!values.rate && transferAgrees(from, values.out, values.in, values.rate);
  const to = from === "DZD" ? "USDT" : "DZD";

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!valid) return;
    const input = {
      from: from === "DZD" ? ("dzd" as const) : ("usdt" as const),
      occurred_on: date,
      amount_out: values.out!,
      amount_in: values.in!,
      rate: values.rate!,
      note: note.trim() || undefined,
    };
    submit(input, (request_key) => transferFunds({ ...input, request_key }), close, t("done"));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label={t("direction")} htmlFor={`${id}-from`}>
        <EnumSelect id={`${id}-from`} value={from}
          onChange={(v) => {
            const side = v === "USDT" ? "USDT" : "DZD";
            // An amount typed in one currency must never be read as the other.
            setFrom(side);
            setValues((s) => ({ ...s, out: null, in: null }));
            setVersion((s) => ({ ...s, out: s.out + 1, in: s.in + 1 }));
          }}
          options={[{ value: "DZD", label: t("dzdToUsdt") }, { value: "USDT", label: t("usdtToDzd") }]} />
      </Field>
      <Field label={t("date")} htmlFor={`${id}-date`}>
        <DateField id={`${id}-date`} value={date} onChange={setDate} />
      </Field>
      <Field label={t("amountOut")} htmlFor={`${id}-out`}>
        <NumberField key={version.out} id={`${id}-out`} unit={from === "DZD" ? "DA" : from} onChange={(v) => quote(from, v, values.rate)} />
      </Field>
      <Field label={t("rate")} htmlFor={`${id}-rate`}>
        <NumberField key={version.rate} id={`${id}-rate`} defaultValue={values.rate} unit="DA"
          onChange={(v) => {
            // Keep this field mounted while typing; only the received amount follows.
            // Without an amount out there is nothing to quote: a typed amount in stays.
            if (!values.out) return setValues((s) => ({ ...s, rate: v }));
            const q = v ? quoteTransfer(from, values.out, v) : null;
            setValues((s) => ({ ...s, rate: v, in: q?.amountIn ?? null }));
            setVersion((s) => ({ ...s, in: s.in + 1 }));
          }} />
      </Field>
      <Field label={t("amountIn")} htmlFor={`${id}-in`}>
        <NumberField key={version.in} id={`${id}-in`} defaultValue={values.in} unit={to === "DZD" ? "DA" : to} onChange={typedIn} />
      </Field>
      <Field label={t("note")} htmlFor={`${id}-note`}>
        <Input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} autoComplete="off" />
      </Field>
      {values.out && values.rate && values.in && !valid ? (
        <p role="alert" className="text-sm text-danger">{t("mismatch")}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy || !valid || !date}>{t("submit")}</Button>
    </form>
  );
}

export function TransferDialog({ rate }: { rate: number | null }) {
  const t = useTranslations("accounts.transfer");
  const ledger = useLedgerSubmit();
  return (
    <MoneyDialog trigger={<><ArrowLeftRight />{t("button")}</>} title={t("title")} description={t("description")}>
      {(close) => <TransferForm rate={rate} close={close} ledger={ledger} />}
    </MoneyDialog>
  );
}

function PayoutForm({ balance, close, ledger: { busy, submit } }: { balance: number; close: () => void; ledger: Submit }) {
  const t = useTranslations("accounts.payout");
  const id = React.useId();
  const [amount, setAmount] = React.useState<number | null>(balance);
  const [date, setDate] = React.useState(() => algiersToday());
  const [note, setNote] = React.useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = { occurred_on: date, amount: amount ?? 0, note: note.trim() || undefined };
    submit(input, (request_key) => markPayoutTaken({ ...input, request_key }), close, t("done"));
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label={t("amount")} htmlFor={`${id}-amount`} hint={t("balance", { amount: formatAccountAmount(balance, "DZD") })}>
        <NumberField id={`${id}-amount`} defaultValue={balance} unit="DA" onChange={setAmount} />
      </Field>
      <Field label={t("date")} htmlFor={`${id}-date`}>
        <DateField id={`${id}-date`} value={date} onChange={setDate} />
      </Field>
      <Field label={t("note")} htmlFor={`${id}-note`}>
        <Input id={`${id}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} autoComplete="off" />
      </Field>
      <Button type="submit" className="w-full" disabled={busy || !amount || !date}>{t("submit")}</Button>
    </form>
  );
}

export function PayoutDialog({ balance }: { balance: number }) {
  const t = useTranslations("accounts.payout");
  const ledger = useLedgerSubmit();
  const empty = !(balance > 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MoneyDialog trigger={<><HandCoins />{t("button")}</>} title={t("title")} description={t("description")} disabled={empty}>
        {(close) => <PayoutForm balance={balance} close={close} ledger={ledger} />}
      </MoneyDialog>
      {empty ? <p className="text-xs text-muted-foreground">{t("disabled")}</p> : null}
    </div>
  );
}
