"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, FileUp, Loader2, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FileField } from "@/components/fields/file-field";
import { formatCurrency } from "@/lib/format";
import type { DeliveryDiffRow, DeliveryWarning } from "@/lib/delivery-prices";
import { applyDeliveryCsv, previewDeliveryCsv, type DeliveryPreview } from "./actions";

type Phase =
  | { name: "idle" }
  | { name: "parsing" }
  | { name: "invalid"; error: string }
  | { name: "preview"; data: Extract<DeliveryPreview, { ok: true }> }
  | { name: "applying"; data: Extract<DeliveryPreview, { ok: true }> }
  | { name: "failed"; data: Extract<DeliveryPreview, { ok: true }>; error: string };

const MAX_CSV_BYTES = 1024 * 1024;

const isWarned = (r: DeliveryDiffRow) => r.warnings.length > 0 || !r.after.priced;

type Filter = "all" | "changed" | "warnings";

export function FeesCsvDialog() {
  const t = useTranslations("settings.deliveryCsv");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [phase, setPhase] = React.useState<Phase>({ name: "idle" });
  const [filter, setFilter] = React.useState<Filter>("all");

  const busy = phase.name === "parsing" || phase.name === "applying";

  function reset() {
    setFile(null);
    setPhase({ name: "idle" });
    setFilter("all");
  }

  async function onPick(f: File | null) {
    if (!f) return;
    setFile(f);
    if (f.size > MAX_CSV_BYTES) return setPhase({ name: "invalid", error: t("tooLarge") }); // the action's 1 MB body limit would hide this
    setPhase({ name: "parsing" });
    const fd = new FormData();
    fd.set("file", f);
    try {
      const res = await previewDeliveryCsv(fd);
      setPhase(res.ok ? { name: "preview", data: res } : { name: "invalid", error: res.error });
    } catch {
      setPhase({ name: "invalid", error: t("invalid") });
    }
  }

  async function onApply() {
    if (!file || (phase.name !== "preview" && phase.name !== "failed")) return;
    const data = phase.data;
    setPhase({ name: "applying", data });
    const fd = new FormData();
    fd.set("file", file);
    fd.set("snapshot", data.snapshot);
    try {
      const res = await applyDeliveryCsv(fd);
      if (!res.ok) return setPhase({ name: "failed", data, error: res.error });
      // a commune-only file changes no fee: say what did change instead of "No prices changed"
      const communeRows = data.diff.rows.filter((r) => r.communesAdded.length || r.communesRemoved.length).length;
      toast.success(res.changed === 0 && communeRows > 0 ? t("successCommunes", { count: communeRows }) : t("success", { count: res.changed }));
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      setPhase({ name: "failed", data, error: t("applyFailed") });
    }
  }

  const data = phase.name === "preview" || phase.name === "applying" || phase.name === "failed" ? phase.data : null;
  const rows = React.useMemo(() => {
    if (!data) return [];
    return data.diff.rows.filter((r) => (filter === "changed" ? r.changed : filter === "warnings" ? isWarned(r) : true));
  }, [data, filter]);
  const warningCount = data ? data.diff.rows.reduce((n, r) => n + r.warnings.length + (r.after.priced ? 0 : 1), 0) + data.diff.fileWarnings.length : 0;
  const changedCount = data ? data.diff.rows.filter((r) => r.changed).length : 0;

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <FileUp className="h-4 w-4" />
        {t("button")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (busy && !o) return;
          setOpen(o);
          if (!o) reset();
        }}
      >
        <DialogContent className="flex max-h-[90dvh] max-w-3xl grid-rows-none flex-col gap-0 p-0">
          <div className="space-y-1 border-b border-border p-5 pe-12">
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite" aria-busy={busy}>
            <div className="space-y-2">
              <FileField
                accept=".csv,text/csv"
                onFile={onPick}
                disabled={busy}
                buttonLabel={t("chooseFile")}
                emptyLabel={t("noFile")}
                fileName={file?.name}
                aria-describedby="csv-format-hint"
              />
              <p id="csv-format-hint" className="text-xs text-muted-foreground">
                <bdi>{t("formatHint")}</bdi>
              </p>
            </div>

            {phase.name === "parsing" ? (
              <div className="space-y-2" role="status" aria-label={t("parsing")}>
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-md bg-border" />
                ))}
              </div>
            ) : null}

            {phase.name === "invalid" ? (
              <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-destructive/40 p-3 text-sm">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>
                    <span className="block font-medium">{t("invalid")}</span>
                    <span className="text-muted-foreground">{phase.error}</span>
                  </span>
                </span>
              </div>
            ) : null}

            {data ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {t("summary", {
                      changed: changedCount,
                      unchanged: data.diff.rows.length - changedCount,
                      warnings: warningCount,
                    })}
                  </p>
                  <div role="group" className="flex gap-1">
                    {(["all", "changed", "warnings"] as const).map((f) => (
                      <Button
                        key={f}
                        type="button"
                        size="sm"
                        variant={filter === f ? "default" : "outline"}
                        aria-pressed={filter === f}
                        onClick={() => setFilter(f)}
                      >
                        {t(f === "all" ? "filterAll" : f === "changed" ? "filterChanged" : "filterWarnings")}
                      </Button>
                    ))}
                  </div>
                </div>

                <FileWarnings warnings={data.diff.fileWarnings} />
                {data.diff.unpricedNotStopped.length ? (
                  <Note text={t("unpricedNotStopped", { list: names(data.diff.unpricedNotStopped, data.wilayaNames) })} />
                ) : null}
                {data.diff.absent.length ? (
                  <Note text={t("absent", { list: names(data.diff.absent, data.wilayaNames) })} />
                ) : null}

                {rows.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">{t("noRows")}</p>
                ) : (
                  <ul className="space-y-2">
                    {rows.map((r) => (
                      <PreviewRow key={r.code} row={r} name={data.wilayaNames[r.code] ?? r.fileName} />
                    ))}
                  </ul>
                )}
              </>
            ) : null}

            {phase.name === "failed" ? (
              <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-3 text-sm">
                <span className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span>
                    <span className="block font-medium">{t("applyFailed")}</span>
                    <span className="text-muted-foreground">{phase.error}</span>
                  </span>
                </span>
                <Button type="button" size="sm" variant="outline" onClick={onApply}>
                  <RotateCw className="h-4 w-4" />
                  {t("retry")}
                </Button>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-border p-4 sm:flex sm:justify-end">
            <Button type="button" variant="outline" disabled={phase.name === "applying"} onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={!(phase.name === "preview" || phase.name === "failed") || (phase.name === "preview" && changedCount === 0)} onClick={onApply}>
              {phase.name === "applying" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {phase.name === "applying" ? t("applying") : t("apply")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function names(codes: number[], map: Record<number, string>) {
  return codes.map((c) => map[c] ?? c).join(", ");
}

function Note({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border p-3 text-xs text-muted-foreground">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <bdi>{text}</bdi>
    </p>
  );
}

function FileWarnings({ warnings }: { warnings: DeliveryWarning[] }) {
  const t = useTranslations("settings.deliveryCsv");
  if (!warnings.length) return null;
  return (
    <ul className="space-y-1">
      {warnings.slice(0, 20).map((w, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
          <bdi>{t(`warn.${w.type}`, { text: w.text })}</bdi>
        </li>
      ))}
    </ul>
  );
}

function fee(n: number | null, label: string) {
  return n === null ? label : formatCurrency(n);
}

/** before → after, following the page direction; numbers stay left-to-right inside their own isolate. */
function Change({ before, after, label }: { before: string; after: string; label: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <bdi>{before}</bdi>
      <ArrowRight className="h-3 w-3 shrink-0 rtl:rotate-180" aria-hidden />
      <span className="sr-only">{label}</span>
      <bdi>{after}</bdi>
    </span>
  );
}

const MAX_NAMES = 12;

function CommuneNames({ label, list }: { label: string; list: string[] }) {
  const t = useTranslations("settings.deliveryCsv");
  if (!list.length) return null;
  const more = list.length - MAX_NAMES;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium">{label}</span> <bdi>{list.slice(0, MAX_NAMES).join(", ")}</bdi>
      {more > 0 ? <> {t("moreNames", { count: more })}</> : null}
    </p>
  );
}

function PreviewRow({ row, name }: { row: DeliveryDiffRow; name: string }) {
  const t = useTranslations("settings.deliveryCsv");
  const a = row.after;
  const homeAfter = a.priced ? fee(a.home_fee, t("noPrice")) : t("noPrice");
  const deskAfter = !a.priced ? t("noPrice") : a.stopdesk_available ? fee(a.stopdesk_fee, t("noPrice")) : t("homeOnly");
  const b = row.before;
  const homeBefore = !b ? "—" : b.priced ? formatCurrency(b.home_fee) : t("noPrice");
  const deskBefore = !b ? "—" : !b.priced ? t("noPrice") : b.stopdesk_available ? formatCurrency(b.stopdesk_fee) : t("homeOnly");
  return (
    <li className="space-y-2 rounded-lg border border-border p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          <bdi>{name}</bdi> <span className="text-xs text-muted-foreground tabular-nums">{row.code}</span>
        </span>
        <Badge variant={row.changed ? "default" : "outline"}>{row.changed ? t("changedBadge") : t("unchangedBadge")}</Badge>
      </div>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">{t("colHome")}</dt>
        <dd className="col-span-2 tabular-nums">
          <Change before={homeBefore} after={homeAfter} label={t("after")} />
        </dd>
        <dt className="text-muted-foreground">{t("colDesk")}</dt>
        <dd className="col-span-2 tabular-nums">
          <Change before={deskBefore} after={deskAfter} label={t("after")} />
        </dd>
        <dt className="text-muted-foreground">{t("colCommunes")}</dt>
        <dd className="col-span-2 tabular-nums">
          <Change before={String(row.communesBefore)} after={String(row.communesAfter)} label={t("after")} />
        </dd>
      </dl>
      <CommuneNames label={t("communesAdded")} list={row.communesAdded} />
      <CommuneNames label={t("communesRemoved")} list={row.communesRemoved} />
      {row.warnings.length ? <FileWarnings warnings={row.warnings} /> : null}
    </li>
  );
}
