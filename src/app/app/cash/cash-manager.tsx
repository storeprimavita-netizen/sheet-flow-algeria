"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/empty";
import { formatCurrency, formatDate } from "@/lib/format";

export type UncollectedRow = {
  id: string;
  order_number: string;
  total_amount: number;
  customer_name: string;
};

export type CollectionRow = {
  id: string;
  order_id: string;
  amount: number;
  collected_by: string | null;
  collected_at: string;
  order_number: string;
  customer_name: string;
};

type DepositRow = {
  id: string;
  amount: number;
  deposit_reference: string | null;
  deposited_at: string | null;
  collected_by: string | null;
  order_number: string;
};

export function CashManager({
  uncollected,
  outstanding,
  deposits,
}: {
  uncollected: UncollectedRow[];
  outstanding: CollectionRow[];
  deposits: DepositRow[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reference, setReference] = useState("");
  const [depositing, setDepositing] = useState(false);

  async function record(e: React.FormEvent<HTMLFormElement>, orderId: string, defaultAmount: number) {
    e.preventDefault();
    setBusyOrder(orderId);
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get("amount"));
    const collectedBy = String(fd.get("collected_by") ?? "").trim() || null;
    const supabase = createClient();
    const { error } = await supabase.from("cash_collections").insert({
      order_id: orderId,
      amount: Number.isFinite(amount) && amount >= 0 ? amount : defaultAmount,
      collected_by: collectedBy,
      status: "held",
    });
    setBusyOrder(null);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function createDeposit() {
    if (selected.size === 0) return;
    setDepositing(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cash_collections")
      .update({
        status: "deposited",
        deposited_at: new Date().toISOString(),
        deposit_reference: reference.trim() || null,
      })
      .in("id", [...selected]);
    setDepositing(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    setSelected(new Set());
    setReference("");
    router.refresh();
  }

  const selectedTotal = outstanding.filter((o) => selected.has(o.id)).reduce((s, o) => s + o.amount, 0);

  return (
    <div className="space-y-6">
      {/* record collection */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("cash.record")}</h2>
        <p className="text-xs text-muted-foreground">{t("cash.recordHint")}</p>
        {!uncollected.length ? (
          <Empty>{t("cash.noUncollected")}</Empty>
        ) : (
          <div className="space-y-2">
            {uncollected.map((o) => (
              <form
                key={o.id}
                onSubmit={(e) => record(e, o.id, o.total_amount)}
                className="glass-card flex flex-wrap items-end gap-3 rounded-xl p-3"
              >
                <div className="min-w-[12rem] flex-1">
                  <div className="font-medium">{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.customer_name} · {t("fields.total_amount")}: {formatCurrency(o.total_amount)}
                  </div>
                </div>
                <Field label={t("cash.amount")} htmlFor={`amt_${o.id}`}>
                  <Input
                    id={`amt_${o.id}`}
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={o.total_amount}
                    className="w-32"
                  />
                </Field>
                <Field label={t("cash.collector")} htmlFor={`col_${o.id}`}>
                  <Input id={`col_${o.id}`} name="collected_by" className="w-40" />
                </Field>
                <Button type="submit" size="sm" disabled={busyOrder === o.id}>
                  {busyOrder === o.id ? t("actions.saving") : t("cash.save")}
                </Button>
              </form>
            ))}
          </div>
        )}
      </section>

      {/* outstanding → deposit */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("cash.outstanding")}</h2>
          {selected.size > 0 ? (
            <span className="text-xs text-muted-foreground">
              {t("cash.selected")}: {selected.size} · {formatCurrency(selectedTotal)}
            </span>
          ) : null}
        </div>
        {!outstanding.length ? (
          <Empty>{t("cash.noOutstanding")}</Empty>
        ) : (
          <>
            <div className="glass-card overflow-hidden rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-start text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="p-3"></th>
                      <th className="p-3 text-start">{t("cash.order")}</th>
                      <th className="p-3 text-start">{t("cash.customer")}</th>
                      <th className="p-3 text-start">{t("cash.collector")}</th>
                      <th className="p-3 text-start">{t("cash.amount")}</th>
                      <th className="p-3 text-start">{t("fields.placed_at")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstanding.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(c.id)}
                            onChange={() => toggle(c.id)}
                            className="h-4 w-4"
                          />
                        </td>
                        <td className="p-3 font-medium">{c.order_number}</td>
                        <td className="p-3 text-muted-foreground">{c.customer_name}</td>
                        <td className="p-3 text-muted-foreground">{c.collected_by ?? "—"}</td>
                        <td className="p-3">{formatCurrency(c.amount)}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(c.collected_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="glass-card flex flex-wrap items-end gap-3 rounded-xl p-3">
              <Field label={t("cash.depositReference")} htmlFor="deposit_ref">
                <Input
                  id="deposit_ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-56"
                />
              </Field>
              <Button type="button" onClick={createDeposit} disabled={selected.size === 0 || depositing}>
                {depositing ? t("actions.saving") : t("cash.createDeposit")}
              </Button>
            </div>
          </>
        )}
      </section>

      {/* deposits history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("cash.deposits")}</h2>
        {!deposits.length ? (
          <Empty>{t("cash.noDeposits")}</Empty>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 text-start">{t("cash.order")}</th>
                    <th className="p-3 text-start">{t("cash.depositReference")}</th>
                    <th className="p-3 text-start">{t("cash.collector")}</th>
                    <th className="p-3 text-start">{t("cash.amount")}</th>
                    <th className="p-3 text-start">{t("fields.placed_at")}</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((d) => (
                    <tr key={d.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-medium">{d.order_number}</td>
                      <td className="p-3">
                        {d.deposit_reference ? <Badge variant="secondary">{d.deposit_reference}</Badge> : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{d.collected_by ?? "—"}</td>
                      <td className="p-3">{formatCurrency(d.amount)}</td>
                      <td className="p-3 text-muted-foreground">{formatDate(d.deposited_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
