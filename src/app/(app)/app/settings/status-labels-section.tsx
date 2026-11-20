"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { normalizeLabel } from "@/lib/emoji";
import { StatusLabelsProvider } from "@/components/status-labels-provider";
import type { StatusLabelOverrides } from "@/lib/status-label";
import { getStatus, type StatusKind } from "@/lib/statuses";
import { resetStatusLabel, saveStatusLabel, type StatusLabelResult } from "./actions";

export type StatusLabelGroup = {
  kind: StatusKind;
  statuses: { key: string; defaultEn: string; defaultAr: string; en: string; ar: string }[];
};

/** Settings → Options & labels: rename how a system status reads, per language. Keys, colors and transitions never change. */
export function StatusLabelsSection({ groups }: { groups: StatusLabelGroup[] }) {
  const t = useTranslations();
  return (
    <section id="status-labels" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <div>
        <h2 className="text-sm font-semibold">{t("settings.statusLabels.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.statusLabels.subtitle")}</p>
      </div>
      {groups.map((g) => (
        <div key={g.kind} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t(`settings.statusLabels.kinds.${g.kind}`)}</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {g.statuses.map((s) => (
              <LabelRow key={`${s.key}:${s.en}:${s.ar}`} kind={g.kind} status={s} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function LabelRow({ kind, status }: { kind: StatusKind; status: StatusLabelGroup["statuses"][number] }) {
  const t = useTranslations();
  const router = useRouter();
  const [en, setEn] = React.useState(status.en);
  const [ar, setAr] = React.useState(status.ar);
  const [busy, setBusy] = React.useState(false);
  const statusName = t(getStatus(kind, status.key)?.label ?? status.key);
  const dirty = en !== status.en || ar !== status.ar;
  const hasOverride = status.en !== "" || status.ar !== "";

  // live preview: the pill reads the typed draft through its own provider
  const draft: StatusLabelOverrides = {
    [kind]: { [status.key]: { en: normalizeLabel(en) || null, ar: normalizeLabel(ar) || null } },
  };

  /** Sends only the language(s) the admin changed; reports which one failed (the first may already be saved). */
  async function save() {
    for (const lang of ["en", "ar"] as const) {
      const value = lang === "en" ? en : ar;
      if (value === (lang === "en" ? status.en : status.ar)) continue;
      const r = await saveStatusLabel({ kind, key: status.key, lang, value });
      if (!r.ok) return { ...r, lang };
    }
    return { ok: true as const };
  }

  async function run(action: () => Promise<StatusLabelResult & { lang?: "en" | "ar" }>, okMsg: string) {
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.ok) {
      const invalid = res.error === "invalid";
      if (res.lang) {
        const language = t(`settings.statusLabels.${res.lang}`);
        return toast.error(t(invalid ? "settings.statusLabels.invalidLang" : "settings.statusLabels.failedLang", { language }));
      }
      return toast.error(invalid ? t("settings.statusLabels.invalid") : t("settings.statusLabels.failed"));
    }
    toast.success(okMsg);
    router.refresh();
  }

  return (
    <li className="grid grid-cols-1 items-center gap-3 p-3 md:grid-cols-[10rem_1fr_1fr_auto]">
      <StatusLabelsProvider overrides={draft}>
        <div className="min-w-0">
          <StatusPill kind={kind} status={status.key} />
        </div>
      </StatusLabelsProvider>
      <label className="space-y-1 text-xs text-muted-foreground">
        <span>{t("settings.statusLabels.en")}</span>
        <Input aria-label={t("settings.statusLabels.inputLabel", { status: statusName, language: t("settings.statusLabels.en") })} dir="ltr" lang="en" maxLength={40} value={en} onChange={(e) => setEn(e.target.value)} placeholder={status.defaultEn} className="h-9" />
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">
        <span>{t("settings.statusLabels.ar")}</span>
        <Input aria-label={t("settings.statusLabels.inputLabel", { status: statusName, language: t("settings.statusLabels.ar") })} dir="rtl" lang="ar" maxLength={40} value={ar} onChange={(e) => setAr(e.target.value)} placeholder={status.defaultAr} className="h-9" />
      </label>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          disabled={busy || !dirty}
          onClick={() => run(save, t("settings.statusLabels.saved"))}
        >
          {t("actions.save")}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          disabled={busy || !hasOverride}
          aria-label={t("settings.statusLabels.reset")}
          title={t("settings.statusLabels.reset")}
          onClick={() => run(() => resetStatusLabel({ kind, key: status.key }), t("settings.statusLabels.resetDone"))}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
