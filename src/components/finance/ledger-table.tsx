"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Undo2 } from "lucide-react";

import { formatAccountAmount, formatDate, ltr } from "@/lib/format";
import { algiersToday } from "@/lib/ledger";
import type { StatusToken } from "@/lib/statuses";
import { tableClass } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reverseEntry } from "@/app/(app)/app/money/accounts/actions";
import { useLedgerSubmit } from "./use-ledger-submit";

export type LedgerFlag = "transfer" | "reversal" | "reversed" | "legacy" | "expense" | "adSpend";

export type LedgerRow = {
  id: string;
  date: string;
  account: string;
  currency: string;
  direction: "in" | "out";
  amount: number;
  category: { label: string; token: StatusToken; emoji: string | null } | null;
  note: string | null;
  flags: LedgerFlag[];
  reversible: boolean;
};

export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  const t = useTranslations("accounts.ledger");
  const tActions = useTranslations("actions");
  const [target, setTarget] = React.useState<LedgerRow | null>(null);
  const { busy, submit } = useLedgerSubmit();
  // No DialogTrigger here, so focus is handed back to the opener by hand.
  const opener = React.useRef<HTMLElement | null>(null);
  const amountText = (r: LedgerRow) => ltr(`${r.direction === "in" ? "+" : "−"} ${formatAccountAmount(r.amount, r.currency)}`);

  function confirm() {
    if (!target) return;
    const input = { entry_id: target.id, occurred_on: algiersToday() };
    submit(input, (request_key) => reverseEntry({ ...input, request_key }), () => {
      // The Reverse button goes away with the refresh: land on the ledger instead.
      opener.current = document.getElementById("ledger");
      setTarget(null);
    }, t("reversedToast"));
  }

  return (
    <>
      {/* relative: keeps the sr-only header inside the scroll box */}
      <div className="relative overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{t("date")}</th>
              <th>{t("account")}</th>
              <th className="num !text-end">{t("amount")}</th>
              <th>{t("category")}</th>
              <th>{t("note")}</th>
              <th><span className="sr-only">{t("actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="num whitespace-nowrap">{formatDate(r.date)}</td>
                <td><bdi>{r.account}</bdi></td>
                <td className={`num whitespace-nowrap text-end ${r.direction === "in" ? "text-success" : "text-danger"}`}>
                  {amountText(r)}
                </td>
                <td>
                  {r.category ? <Chip size="sm" token={r.category.token} emoji={r.category.emoji}>{r.category.label}</Chip> : "—"}
                </td>
                <td className="min-w-40">
                  <span className="flex flex-wrap items-center gap-1">
                    {r.flags.map((f) => (
                      <Chip key={f} size="sm" token={f === "reversal" || f === "reversed" ? "warning" : "neutral"}>
                        {t(`flags.${f}`)}
                      </Chip>
                    ))}
                    {r.note ? <bdi className="break-words">{r.note}</bdi> : null}
                  </span>
                </td>
                <td className="text-end">
                  {r.reversible ? (
                    <Button type="button" variant="ghost" size="sm" aria-label={t("reverseRow", { amount: amountText(r), date: formatDate(r.date) })}
                      onClick={(e) => { opener.current = e.currentTarget; setTarget(r); }}>
                      <Undo2 className="rtl:-scale-x-100" />
                      {t("reverse")}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{t("reverseTitle")}</DialogTitle>
            <DialogDescription>
              {target?.flags.includes("transfer") ? t("reverseTransferBody") : t("reverseBody")}
            </DialogDescription>
          </DialogHeader>
          {target ? (
            <p className="num text-sm">
              {target.account} · {amountText(target)} · {formatDate(target.date)}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setTarget(null)}>{tActions("cancel")}</Button>
            <Button type="button" variant="destructive" onClick={confirm} disabled={busy}>{t("reverse")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
