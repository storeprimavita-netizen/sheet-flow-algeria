"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";

import { formatAccountAmount, formatDate } from "@/lib/format";
import { isLowBalance, type AccountKind } from "@/lib/ledger";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AccountForm } from "./account-form";

export type AccountCard = {
  id: string;
  kind: AccountKind | null;
  name: string;
  currency: string;
  balance: number;
  low_balance_threshold: number;
  is_active: boolean;
  lastMovement: string | null;
};

export function AccountCards({
  accounts,
  total,
  rate,
}: {
  accounts: AccountCard[];
  total: number | null;
  rate: { value: number; since: string } | null;
}) {
  const t = useTranslations("accounts");
  const [editing, setEditing] = React.useState<AccountCard | null>(null);
  // No DialogTrigger here, so focus is handed back to the opener by hand.
  const opener = React.useRef<HTMLButtonElement | null>(null);

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {accounts.map((a) => (
          <li key={a.id} className="card-surface space-y-2 rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <span className="truncate">{a.name}</span>
                {a.kind === null ? <Chip token="warning" size="sm">{t("cards.pending")}</Chip> : null}
                {a.is_active ? null : <Chip size="sm">{t("cards.inactive")}</Chip>}
              </h2>
              <Button type="button" variant="ghost" size="icon" onClick={(e) => { opener.current = e.currentTarget; setEditing(a); }} aria-label={t("cards.edit", { name: a.name })}>
                <Pencil />
              </Button>
            </div>
            <p className={`num text-2xl font-semibold ${a.balance < 0 ? "text-danger" : ""}`}>
              <Link href={`/app/money/accounts?account=${a.id}#ledger`} className="hover:underline">
                {formatAccountAmount(a.balance, a.currency)}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground">
              {a.lastMovement ? t("cards.lastMovement", { date: formatDate(a.lastMovement) }) : t("cards.noMovement")}
            </p>
            {a.is_active && isLowBalance(a.balance, a.low_balance_threshold) ? (
              <p className="rounded-md bg-danger-bg px-2 py-1 text-xs font-medium text-danger">{t("lowBalance")}</p>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="card-surface flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-4 py-3 text-sm">
        {total !== null && rate ? (
          <>
            <span className="text-muted-foreground">
              {t("cards.total")} · {t("cards.rate", { rate: rate.value, date: formatDate(rate.since) })}
            </span>
            <span className="num text-lg font-semibold">{formatAccountAmount(total, "DZD")}</span>
          </>
        ) : (
          <p className="text-muted-foreground">
            {t("cards.noRate")}{" "}
            <Link href="/app/settings?section=exchange-rates" className="text-foreground underline underline-offset-2">
              {t("cards.addRate")}
            </Link>
          </p>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent aria-describedby={undefined}
          onCloseAutoFocus={(e) => { e.preventDefault(); opener.current?.focus(); }}>
          <DialogHeader>
            <DialogTitle>{t("cards.editTitle")}</DialogTitle>
          </DialogHeader>
          {editing ? <AccountForm account={editing} onDone={() => setEditing(null)} /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
