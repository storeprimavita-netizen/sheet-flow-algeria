"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CalendarRange, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DateField } from "@/components/fields/date-field";
import { DeleteButton } from "@/components/delete-button";
import { Empty } from "@/components/empty";
import { Field } from "@/components/field";
import { formatDate } from "@/lib/format";
import { useSubmitAction } from "@/lib/use-submit-action";
import { createSeason, renameSeason, savePeriod, type SeasonState } from "./actions";

type Period = { id: string; year: number; date_from: string; date_to: string };
type Season = { id: string; label: string; name: string; periods: Period[] };

function useErrorText(state: SeasonState) {
  const t = useTranslations("settings.seasons.err");
  return state && "error" in state ? t(state.error) : null;
}

/** One small form dialog shared by "rename season" and "add / edit period". Keeps typed values on error (D62). */
function FormDialog({
  open,
  onOpenChange,
  title,
  action,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  action: (prev: SeasonState, fd: FormData) => Promise<SeasonState>;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const [state, formAction, pending] = React.useActionState(action, undefined);
  const onSubmit = useSubmitAction(formAction);
  const error = useErrorText(state);
  React.useEffect(() => {
    if (state && "ok" in state) onOpenChange(false);
  }, [state, onOpenChange]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        <form method="post" onSubmit={onSubmit} className="space-y-4">
          {children}
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("actions.cancel")}</Button>
            <Button type="submit" disabled={pending}>{t("actions.save")}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PeriodDialog({ seasonId, period, open, onOpenChange }: { seasonId: string; period?: Period; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("settings.seasons");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={period ? t("editPeriod") : t("addPeriod")} action={savePeriod}>
      <input type="hidden" name="season_id" value={seasonId} />
      {period ? <input type="hidden" name="id" value={period.id} /> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label={t("dateFrom")}><DateField name="date_from" defaultValue={period?.date_from ?? ""} /></Field>
        <Field label={t("dateTo")}><DateField name="date_to" defaultValue={period?.date_to ?? ""} /></Field>
      </div>
      <p className="text-xs text-muted-foreground">{t("yearRule")}</p>
    </FormDialog>
  );
}

function RenameDialog({ season, open, onOpenChange }: { season: Season; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("settings.seasons");
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={t("rename")} action={renameSeason}>
      <input type="hidden" name="id" value={season.id} />
      <Field label={t("name")} htmlFor={`season-name-${season.id}`}>
        <Input id={`season-name-${season.id}`} name="name" defaultValue={season.name} maxLength={80} required />
      </Field>
    </FormDialog>
  );
}

function SeasonCard({ season }: { season: Season }) {
  const t = useTranslations("settings.seasons");
  const [renaming, setRenaming] = React.useState(false);
  const [period, setPeriod] = React.useState<{ open: boolean; edit?: Period }>({ open: false });
  return (
    <section className="card-surface space-y-3 rounded-xl p-4" aria-labelledby={`season-${season.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`season-${season.id}`} className="text-sm font-semibold"><bdi>{season.label}</bdi></h2>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setRenaming(true)}>
            <Pencil className="h-3.5 w-3.5" />{t("rename")}
          </Button>
          <DeleteButton
            variant="outline"
            className="text-danger"
            table="seasons"
            id={season.id}
            redirectTo="/app/settings/seasons"
            label={t("deleteSeasonLabel", { name: season.label })}
            confirmText={t("deleteSeasonConfirm", { name: season.label })}
          />
        </div>
      </div>

      {season.periods.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground sm:flex-row sm:justify-between sm:text-start">
          <span>{t("noDates")}</span>
          <Button type="button" size="sm" className="gap-1.5" onClick={() => setPeriod({ open: true })}>
            <Plus className="h-3.5 w-3.5" />{t("addDates")}
          </Button>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {season.periods.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="flex items-baseline gap-3">
                  <span className="num font-medium"><bdi dir="ltr">{p.year}</bdi></span>
                  <span className="text-muted-foreground"><bdi dir="ltr">{formatDate(p.date_from)} – {formatDate(p.date_to)}</bdi></span>
                </span>
                <span className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={() => setPeriod({ open: true, edit: p })}>
                    <Pencil className="h-3.5 w-3.5" />{t("editPeriod")}
                  </Button>
                  <DeleteButton
            variant="outline"
                    className="text-danger"
                    table="season_periods"
                    id={p.id}
                    redirectTo="/app/settings/seasons"
                    label={t("deletePeriodLabel", { name: season.label, year: p.year })}
                  />
                </span>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setPeriod({ open: true })}>
            <Plus className="h-3.5 w-3.5" />{t("addPeriod")}
          </Button>
        </>
      )}

      {renaming ? <RenameDialog season={season} open onOpenChange={setRenaming} /> : null}
      {period.open ? (
        <PeriodDialog seasonId={season.id} period={period.edit} open onOpenChange={(o) => !o && setPeriod({ open: false })} />
      ) : null}
    </section>
  );
}

export function SeasonsEditor({ seasons }: { seasons: Season[] }) {
  const t = useTranslations("settings.seasons");
  const [state, formAction, pending] = React.useActionState(createSeason, undefined);
  const onSubmit = useSubmitAction(formAction);
  const error = useErrorText(state);
  const [formKey, setFormKey] = React.useState(0);
  React.useEffect(() => {
    if (state && "ok" in state) setFormKey((k) => k + 1); // clear the field only after a saved season
  }, [state]);

  return (
    <div className="space-y-4">
      <form key={formKey} method="post" onSubmit={onSubmit} className="card-surface flex flex-wrap items-end gap-3 rounded-xl p-4">
        <Field label={t("addSeason")} htmlFor="season-new-name" className="min-w-0 flex-1 basis-56">
          <Input id="season-new-name" name="name" maxLength={80} required placeholder={t("namePlaceholder")} />
        </Field>
        <Button type="submit" disabled={pending} className="gap-1.5"><Plus className="h-4 w-4" />{t("add")}</Button>
        {error ? <p role="alert" className="w-full text-sm text-danger">{error}</p> : null}
      </form>

      {seasons.length === 0 ? (
        <Empty>
          <CalendarRange className="mx-auto mb-2 h-6 w-6" aria-hidden />
          <p className="font-medium text-foreground">{t("empty")}</p>
        </Empty>
      ) : (
        seasons.map((s) => <SeasonCard key={s.id} season={s} />)
      )}
    </div>
  );
}
