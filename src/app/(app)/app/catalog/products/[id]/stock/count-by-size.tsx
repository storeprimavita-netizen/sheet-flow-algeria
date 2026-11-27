"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumberField } from "@/components/fields/number-field";
import { countBySize } from "../../actions";

type Row = { id: string; label: string; stock: number };

/** Count by size (D54.2). Absolute shelf counts; an empty size is left alone. Enter in any field submits. */
export function CountBySize({ productId, rows, notAssigned }: { productId: string; rows: Row[]; notAssigned: number }) {
  const t = useTranslations("stock");
  const router = useRouter();
  const [counts, setCounts] = React.useState<Record<string, number | null>>({});
  const [busy, setBusy] = React.useState(false);
  const [state, setState] = React.useState<{ ok: true; changed: number } | { ok: false; error: string } | null>(null);
  const [formKey, setFormKey] = React.useState(0);

  if (!rows.length) return null;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const entries = Object.entries(counts)
      .filter((e): e is [string, number] => e[1] != null && Number.isFinite(e[1]))
      .map(([variant_id, count]) => ({ variant_id, count: Math.round(count) }));
    if (!entries.length) return;
    setBusy(true);
    setState(null);
    const res = await countBySize(productId, entries);
    setBusy(false);
    setState(res);
    if (res.ok) {
      setCounts({});
      setFormKey((k) => k + 1); // empty the fields again
      router.refresh();
    }
  }

  const anyTyped = Object.values(counts).some((v) => v != null);

  return (
    <form onSubmit={submit} className="card-surface space-y-4 rounded-xl p-5" aria-busy={busy} aria-labelledby="count-title">
      <div className="space-y-1">
        <h2 id="count-title" className="text-sm font-semibold">
          {t("countTitle")}
        </h2>
        <p className="text-xs text-muted-foreground">{t("countHint")}</p>
      </div>
      <div key={formKey} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <label key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
            <span className="min-w-0 truncate">
              <bdi className="font-medium">{r.label}</bdi>
              <span className="num ms-2 text-xs text-muted-foreground">{t("countNow", { n: r.stock })}</span>
            </span>
            <NumberField
              className="w-24"
              integer
              aria-label={t("countInput", { label: r.label })}
              placeholder={String(r.stock)}
              disabled={busy}
              onChange={(v) => setCounts((c) => ({ ...c, [r.id]: v != null && Number.isFinite(v) ? v : null }))}
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={busy || !anyTyped}>
          {t("countSubmit")}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {notAssigned === 0 ? t("countLeftZero") : t("countLeft", { n: notAssigned })}
        </p>
      </div>
      {state ? (
        state.ok ? (
          <p role="status" className="text-sm text-success">
            {t("countSaved", { n: state.changed })}
          </p>
        ) : (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            <span>{t("countError", { reason: state.error })}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => submit()} disabled={busy}>
              <RotateCw />
              {t("countRetry")}
            </Button>
          </div>
        )
      ) : null}
    </form>
  );
}
