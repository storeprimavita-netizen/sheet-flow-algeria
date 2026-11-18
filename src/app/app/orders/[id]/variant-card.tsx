"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Field } from "@/components/field";
import { changeOrderVariant } from "../actions";

type Size = { id: string; label: string; isActive: boolean };

/** Assign or change the size of an order (admin). The hold moves with it; the label is rewritten by the database. */
export function VariantCard({
  orderId,
  currentId,
  oldLabel,
  sizes,
}: {
  orderId: string;
  currentId: string | null;
  /** text typed before sizes existed (no link), shown read-only */
  oldLabel: string | null;
  sizes: Size[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [value, setValue] = useState(currentId ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // new choices are active sizes only; the current one stays visible even if it was deactivated since
  const options = sizes.filter((s) => s.isActive || s.id === currentId);

  async function save() {
    if (!value || value === currentId) return;
    setBusy(true);
    setMsg(null);
    const res = await changeOrderVariant(orderId, value);
    setBusy(false);
    if (!res.ok) {
      setMsg({ ok: false, text: t("orders.sizeFailed", { reason: res.error }) });
      return;
    }
    setMsg({ ok: true, text: t("orders.sizeSaved") });
    router.refresh();
  }

  return (
    <div className="card-surface space-y-4 rounded-xl p-5" aria-busy={busy}>
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Ruler className="h-4 w-4" />
        {t("orders.sizeTitle")}
      </h2>
      {!currentId && oldLabel ? (
        <p className="text-sm">
          <bdi className="font-medium">{oldLabel}</bdi>
          <span className="ms-2 text-xs text-muted-foreground">{t("orders.sizeOldHint")}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("orders.chooseSize")} className="min-w-48">
          <Select value={value} onValueChange={setValue} disabled={busy}>
            <SelectTrigger>
              <SelectValue placeholder={t("orders.chooseSize")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <bdi>{s.isActive ? s.label : t("orders.sizeInactive", { label: s.label })}</bdi>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button type="button" size="sm" onClick={save} disabled={busy || !value || value === currentId}>
          {currentId ? t("orders.changeSize") : t("orders.assignSize")}
        </Button>
      </div>
      {msg ? (
        <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "text-sm text-success" : "rounded-md bg-danger-bg px-3 py-2 text-sm text-danger"}>
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
