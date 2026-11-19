"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ViewResult } from "./views-actions";

export type NameValues = { name: string; emoji: string; shared: boolean };

/** Name (+ emoji, + shared/personal for admins) form used by "Save as" and "Rename". */
export function ViewNameDialog({
  open,
  onOpenChange,
  title,
  hint,
  initial,
  canShare,
  submitLabel,
  onSubmit,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  hint?: string;
  initial: { name: string; emoji: string };
  canShare: boolean;
  submitLabel: string;
  onSubmit: (v: NameValues) => Promise<ViewResult>;
  returnFocus: () => HTMLElement | null;
}) {
  const t = useTranslations("orderViews");
  const id = useId();
  const [name, setName] = useState(initial.name);
  const [emoji, setEmoji] = useState(initial.emoji);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const graphemes = (s: string) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].length;
  const emojiBad = emoji.trim().length > 16 || graphemes(emoji.trim()) > 1;
  const invalid = !name.trim() || name.trim().length > 60 || emojiBad;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || busy) return;
    setBusy(true);
    setError(null);
    const r = await onSubmit({ name, emoji, shared });
    setBusy(false);
    if (r.ok) onOpenChange(false);
    else setError(t(`error.${r.error}`));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          returnFocus()?.focus();
        }}
      >
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {hint ? <DialogDescription>{hint}</DialogDescription> : null}
          </DialogHeader>
          <Field label={t("nameLabel")} htmlFor={`${id}-name`} hint={`${name.trim().length}/60`}>
            <Input id={`${id}-name`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus required />
          </Field>
          <Field label={t("emojiLabel")} htmlFor={`${id}-emoji`}>
            <Input id={`${id}-emoji`} value={emoji} maxLength={16} onChange={(e) => setEmoji(e.target.value)} className="w-24" aria-invalid={emojiBad} />
          </Field>
          {canShare ? (
            <div role="radiogroup" aria-label={t("visibility")} className="flex gap-2">
              {[false, true].map((v) => (
                <Button
                  key={String(v)}
                  type="button"
                  role="radio"
                  aria-checked={shared === v}
                  variant={shared === v ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShared(v)}
                >
                  {v ? t("shared") : t("personal")}
                </Button>
              ))}
            </div>
          ) : null}
          <p role="alert" className={cn("text-sm text-danger", !error && "hidden")}>
            {error}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={invalid || busy}>
              {error ? t("retry") : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
