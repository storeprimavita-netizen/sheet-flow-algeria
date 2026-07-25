"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/empty";
import { formatDate } from "@/lib/format";

export type StockProduct = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  is_active: boolean;
};

export type MovementRow = {
  id: string;
  delta: number;
  reason: string;
  note: string | null;
  reference: string | null;
  created_at: string;
  product_name: string;
};

const REASONS = ["initial", "restock", "order", "return", "adjustment", "removal"] as const;

export function StockManager({
  products,
  movements,
  threshold,
}: {
  products: StockProduct[];
  movements: MovementRow[];
  threshold: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [thr, setThr] = useState(String(threshold));
  const [savingThr, setSavingThr] = useState(false);

  async function adjust(e: React.FormEvent<HTMLFormElement>, productId: string) {
    e.preventDefault();
    setBusyId(productId);
    const fd = new FormData(e.currentTarget);
    const delta = Number(fd.get("delta"));
    const reason = String(fd.get("reason") ?? "adjustment");
    const note = String(fd.get("note") ?? "").trim() || null;
    const reference = String(fd.get("reference") ?? "").trim() || null;
    if (!Number.isFinite(delta) || delta === 0) {
      setBusyId(null);
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("stock_movements").insert({
      product_id: productId,
      delta,
      reason,
      note,
      reference,
    });
    setBusyId(null);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  async function saveThreshold() {
    setSavingThr(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "stock_low_threshold", value: thr }, { onConflict: "key" });
    setSavingThr(false);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-sm font-semibold">{t("stock.onHand")}</h2>
          <form className="flex items-end gap-2" onSubmit={(e) => e.preventDefault()}>
            <Field label={t("stock.threshold")} htmlFor="thr">
              <Input
                id="thr"
                type="number"
                min="0"
                value={thr}
                onChange={(e) => setThr(e.target.value)}
                className="w-24"
              />
            </Field>
            <Button type="button" size="sm" onClick={saveThreshold} disabled={savingThr}>
              {savingThr ? t("actions.saving") : t("actions.save")}
            </Button>
          </form>
        </div>

        {!products.length ? (
          <Empty>{t("products.none")}</Empty>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 text-start">{t("fields.product")}</th>
                    <th className="p-3 text-start">{t("fields.sku")}</th>
                    <th className="p-3 text-start">{t("stock.stock")}</th>
                    <th className="p-3 text-start">{t("stock.adjust")}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const out = p.stock <= 0;
                    const low = !out && p.stock <= threshold;
                    return (
                      <tr key={p.id} className="border-b border-border/50 align-top hover:bg-muted/30">
                        <td className="p-3 font-medium">{p.name}</td>
                        <td className="p-3 text-muted-foreground">{p.sku ?? "—"}</td>
                        <td className="p-3">
                          <Badge variant={out ? "destructive" : low ? "secondary" : "default"}>
                            {p.stock}
                            {out ? ` · ${t("stock.out")}` : low ? ` · ${t("stock.low")}` : ""}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <form
                            onSubmit={(e) => adjust(e, p.id)}
                            className="flex flex-wrap items-end gap-2"
                          >
                            <Input
                              name="delta"
                              type="number"
                              placeholder="±"
                              className="w-16"
                              required
                            />
                            <Select name="reason" defaultValue="restock" className="w-auto">
                              {REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {t(`stock.reasons.${r}`)}
                                </option>
                              ))}
                            </Select>
                            <Input
                              name="note"
                              placeholder={t("stock.note")}
                              className="w-32"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              variant="secondary"
                              disabled={busyId === p.id}
                            >
                              <ArrowUp className="h-4 w-4 text-emerald-600" />
                              <ArrowDown className="h-4 w-4 text-destructive" />
                            </Button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("stock.history")}</h2>
        {!movements.length ? (
          <Empty>{t("stock.noHistory")}</Empty>
        ) : (
          <div className="glass-card overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="p-3 text-start">{t("fields.placed_at")}</th>
                    <th className="p-3 text-start">{t("fields.product")}</th>
                    <th className="p-3 text-start">{t("stock.delta")}</th>
                    <th className="p-3 text-start">{t("stock.reason")}</th>
                    <th className="p-3 text-start">{t("stock.note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground">{formatDate(m.created_at)}</td>
                      <td className="p-3 font-medium">{m.product_name}</td>
                      <td className={`p-3 font-medium ${m.delta >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                        {m.delta >= 0 ? "+" : ""}
                        {m.delta}
                      </td>
                      <td className="p-3">{t(`stock.reasons.${m.reason}`)}</td>
                      <td className="p-3 text-muted-foreground">{m.note ?? m.reference ?? "—"}</td>
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
