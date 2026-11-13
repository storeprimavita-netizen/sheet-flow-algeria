"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardPaste } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AutoTextarea } from "@/components/fields/auto-textarea";
import { MoneyField } from "@/components/fields/money-field";
import { tableClass } from "@/components/field";
import { saveWilayaFees } from "./actions";

type FeeRow = {
  wilaya_code: number;
  home_fee: number;
  stopdesk_fee: number;
  stop_shipping: boolean;
  wilaya: { name: string } | null;
};

type RowValues = { home: number; stopdesk: number };

export function FeesSection({
  rows,
  autoFlagged,
}: {
  rows: FeeRow[];
  autoFlagged: Set<number>;
}) {
  const t = useTranslations();
  const [values, setValues] = React.useState<Record<number, RowValues>>(() =>
    Object.fromEntries(rows.map((r) => [r.wilaya_code, { home: r.home_fee, stopdesk: r.stopdesk_fee }])),
  );
  const [gen, setGen] = React.useState(0);
  const [pasteOpen, setPasteOpen] = React.useState(false);
  const pasteRef = React.useRef<HTMLTextAreaElement>(null);

  function applyPaste() {
    const text = pasteRef.current?.value ?? "";
    const next = { ...values };
    let count = 0;
    for (const line of text.split("\n")) {
      const parts = line.split(/\t|,/).map((p) => p.trim());
      if (parts.length < 2) continue;
      const code = Number(parts[0]);
      if (!next[code]) continue;
      const home = Number(parts[1]);
      const stopdesk = parts[2] !== undefined ? Number(parts[2]) : next[code].stopdesk;
      if (!Number.isFinite(home)) continue;
      next[code] = { home, stopdesk: Number.isFinite(stopdesk) ? stopdesk : next[code].stopdesk };
      count++;
    }
    setValues(next);
    setGen((g) => g + 1);
    if (pasteRef.current) pasteRef.current.value = "";
    setPasteOpen(false);
    toast.success(t("settings.pastedApplied", { count }));
  }

  return (
    <section id="delivery-fees" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("settings.deliveryFees")}</h2>
        <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen((o) => !o)}>
          <ClipboardPaste className="h-4 w-4" />
          {t("settings.bulkPaste")}
        </Button>
      </div>

      {pasteOpen ? (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("settings.bulkPasteHint")}</p>
          <AutoTextarea ref={pasteRef} placeholder={"16\t150\t200\n9\t120\t180"} className="font-mono text-xs" />
          <Button type="button" size="sm" onClick={applyPaste}>
            {t("settings.applyPasted")}
          </Button>
        </div>
      ) : null}

      <form action={saveWilayaFees} className="space-y-4">
        <div className="max-h-[28rem] overflow-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>{t("fields.name")}</th>
                <th>{t("settings.homeFee")}</th>
                <th>{t("settings.stopdeskFee")}</th>
                <th>{t("settings.stopShipping")}</th>
                <th>{t("dashboard.wilaya.stopShippingAuto")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.wilaya_code}>
                  <td>{r.wilaya?.name ?? r.wilaya_code}</td>
                  <td>
                    <MoneyField
                      key={`home-${r.wilaya_code}-${gen}`}
                      name={`home_${r.wilaya_code}`}
                      defaultValue={values[r.wilaya_code]?.home ?? r.home_fee}
                      className="w-32"
                    />
                  </td>
                  <td>
                    <MoneyField
                      key={`stopdesk-${r.wilaya_code}-${gen}`}
                      name={`stopdesk_${r.wilaya_code}`}
                      defaultValue={values[r.wilaya_code]?.stopdesk ?? r.stopdesk_fee}
                      className="w-32"
                    />
                  </td>
                  <td>
                    <Switch name={`stop_${r.wilaya_code}`} defaultChecked={r.stop_shipping} />
                  </td>
                  <td>{autoFlagged.has(r.wilaya_code) ? <Badge variant="destructive">🚫</Badge> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="submit">{t("actions.save")}</Button>
      </form>
    </section>
  );
}
