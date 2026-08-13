"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { formatCurrency } from "@/lib/format";
import { Chip } from "@/components/ui/chip";
import { tableClass } from "@/components/field";
import { Empty } from "@/components/empty";
import { AccountForm } from "./account-form";
import { TopupForm } from "./topup-form";

type AccountRow = {
  id: string;
  name: string;
  currency: string;
  opening_balance: number;
  low_balance_threshold: number;
  is_active: boolean;
  balance: number;
};

export function AccountTable({ accounts }: { accounts: AccountRow[] }) {
  const t = useTranslations();
  const [editing, setEditing] = React.useState<string | null>(null);
  const [topupping, setTopupping] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  if (!accounts.length) {
    return (
      <div className="card-surface rounded-xl p-5">
        <Empty>{t("accounts.noAccounts")}</Empty>
        {!creating ? (
          <button
            type="button"
            className="mt-3 text-sm text-primary hover:underline"
            onClick={() => setCreating(true)}
          >
            + {t("actions.create")}
          </button>
        ) : null}
        {creating ? <AccountForm onDone={() => setCreating(false)} /> : null}
      </div>
    );
  }

  return (
    <div className="card-surface space-y-4 rounded-xl p-5">
      <div className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th>{t("accounts.fields.name")}</th>
              <th>{t("accounts.fields.currency")}</th>
              <th className="num">{t("accounts.fields.openingBalance")}</th>
              <th className="num">{t("accounts.balance")}</th>
              <th className="num">{t("accounts.lowBalance")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const isLow = a.is_active && a.balance <= a.low_balance_threshold;
              return (
                <React.Fragment key={a.id}>
                  <tr className={!a.is_active ? "opacity-50" : ""}>
                    <td className="font-medium">{a.name}</td>
                    <td>{a.currency}</td>
                    <td className="num">{formatCurrency(a.opening_balance)}</td>
                    <td className={`num ${a.balance >= 0 ? "text-success" : "text-danger"}`}>
                      {formatCurrency(a.balance)}
                    </td>
                    <td className="num">
                      {a.low_balance_threshold > 0 ? formatCurrency(a.low_balance_threshold) : "—"}
                    </td>
                    <td className="space-x-1">
                      {isLow ? (
                        <Chip token="danger" size="sm">{t("accounts.lowBalance")}</Chip>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setTopupping(a.id)}
                      >
                        +{t("accounts.topup.title").replace("Record ", "")}
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setEditing(a.id)}
                      >
                        {t("actions.edit")}
                      </button>
                    </td>
                  </tr>
                  {editing === a.id ? (
                    <tr>
                      <td colSpan={6} className="border-t border-border bg-surface-raised p-3">
                        <AccountForm
                          account={a}
                          onDone={() => setEditing(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                  {topupping === a.id ? (
                    <tr>
                      <td colSpan={6} className="border-t border-border bg-surface-raised p-3">
                        <TopupForm
                          accountId={a.id}
                          onDone={() => setTopupping(null)}
                        />
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!creating ? (
        <button
          type="button"
          className="text-sm text-primary hover:underline"
          onClick={() => setCreating(true)}
        >
          + {t("actions.create")}
        </button>
      ) : null}
      {creating ? <AccountForm onDone={() => setCreating(false)} /> : null}
    </div>
  );
}
