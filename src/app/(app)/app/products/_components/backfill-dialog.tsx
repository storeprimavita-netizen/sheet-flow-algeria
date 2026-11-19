"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mergeSizeSet, type OptionKind } from "@/lib/variants";
import type { VariantResult } from "../actions";

export type SizeSetDTO = { id: string; name: string; items: string[] };
export type OptionDraft = { name: string; kind: OptionKind; values: { id: string; label: string }[]; backfillId: string };

/**
 * Adds a Size/Color option to a product whose sizes already exist: the owner chooses the value every existing size gets.
 * Nothing is added until "Add" succeeds; Cancel leaves the product untouched.
 */
export function BackfillDialog({
  kind,
  defaultName,
  count,
  sizeSets,
  onCancel,
  onConfirm,
}: {
  kind: OptionKind;
  defaultName: string;
  count: number;
  sizeSets: SizeSetDTO[];
  onCancel: () => void;
  onConfirm: (draft: OptionDraft) => Promise<VariantResult>;
}) {
  const t = useTranslations("variants");
  const [name, setName] = React.useState(defaultName);
  const [values, setValues] = React.useState<{ id: string; label: string }[]>([]);
  const [draft, setDraft] = React.useState("");
  const [backfillId, setBackfillId] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const add = (labels: string[]) => {
    setValues((vs) => {
      const fresh = mergeSizeSet(vs.map((v) => v.label), labels.map((l) => l.trim()).filter(Boolean));
      return [...vs, ...fresh.map((label) => ({ id: crypto.randomUUID(), label }))];
    });
    setDraft("");
  };
  const chosen = values.find((v) => v.id === backfillId);
  const ready = !!name.trim() && !!chosen && !busy;

  async function confirm() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    const res = await onConfirm({ name: name.trim(), kind, values, backfillId });
    setBusy(false);
    if (!res.ok) setError(res.code === "stale" ? t("stale") : res.code === "invalid" ? t("backfillInvalid") : res.code === "duplicate_variant" ? t("duplicateVariant") : t("failed", { reason: res.error }));
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !busy && onCancel()}>
      <DialogContent className="max-w-md" aria-busy={busy} onCloseAutoFocus={(e) => e.preventDefault()}>
        <DialogTitle>{kind === "color" ? t("addColorTitle") : t("addOptionTitle")}</DialogTitle>
        <DialogDescription>{t("backfillIntro", { count })}</DialogDescription>
        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t("optionName")}</span>
            <Input value={name} maxLength={60} dir="auto" onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("dialogValues")}</p>
            {!values.length ? <p className="text-xs text-muted-foreground">{t("dialogNoValues")}</p> : null}
            <ul className="flex flex-wrap gap-1.5">
              {values.map((v) => (
                <li key={v.id} className="flex items-center gap-1 rounded-md border border-border ps-2 text-sm">
                  <bdi>{v.label}</bdi>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={t("removeValue", { label: v.label })} onClick={() => { setValues(values.filter((x) => x.id !== v.id)); if (backfillId === v.id) setBackfillId(""); }}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                aria-label={t("valueLabel")}
                value={draft}
                maxLength={60}
                dir="auto"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add([draft]); } }}
              />
              <Button type="button" variant="outline" disabled={!draft.trim()} onClick={() => add([draft])}>
                <Plus />
                {t("addValueShort")}
              </Button>
            </div>
            {kind === "text" && sizeSets.length ? (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("useSizeSet")}>
                {sizeSets.map((s) => (
                  <Button key={s.id} type="button" variant="outline" size="sm" onClick={() => add(s.items)}>
                    {t("useSet", { name: s.name })}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
          <div className="space-y-1">
            <p id="backfill-label" className="text-sm font-medium">{t("backfillLabel")}</p>
            <Select value={backfillId} onValueChange={setBackfillId} disabled={!values.length}>
              <SelectTrigger aria-labelledby="backfill-label" aria-required="true">
                <SelectValue placeholder={t("backfillPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {values.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chosen ? <p className="text-xs text-muted-foreground">{t("backfillConsequence", { count, value: chosen.label })}</p> : null}
          </div>
          {error ? <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>{t("cancel")}</Button>
            <Button type="button" disabled={!ready} onClick={confirm}>
              {busy ? t("saving") : error ? t("retry") : t("addAndSave")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
