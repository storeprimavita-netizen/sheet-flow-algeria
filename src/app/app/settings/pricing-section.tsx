"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PricingFieldGroups, TargetEditor } from "@/components/pricing/pricing-fields";
import { formErrors, formFromSettings, settingsFromForm, type PricingForm } from "@/lib/pricing-form";
import { DEFAULT_PRICING_SETTINGS, type PricingSettings } from "@/lib/pricing-v2";
import { resetPricingDefaults, savePricingDefaults } from "./actions";

const GROUPS = ["funnel", "ads", "platform", "perOrder", "stock", "rates"] as const;

export function PricingSection({ settings, saved }: { settings: PricingSettings; saved: boolean }) {
  const t = useTranslations("pricingV2");
  const tc = useTranslations();
  const [form, setForm] = React.useState<PricingForm>(() => formFromSettings(settings));
  const [baseline, setBaseline] = React.useState(() => JSON.stringify(formFromSettings(settings)));
  const [usingBuiltIn, setUsingBuiltIn] = React.useState(!saved);
  const [resetKey, setResetKey] = React.useState(0);
  const [pending, startTransition] = React.useTransition();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const errors = formErrors(form, true);
  const valid = Object.keys(errors).length === 0;
  const dirty = JSON.stringify(form) !== baseline;

  function save() {
    if (!valid) return;
    startTransition(async () => {
      const res = await savePricingDefaults(settingsFromForm(form));
      if (res.ok) {
        setBaseline(JSON.stringify(form));
        setUsingBuiltIn(false);
        toast.success(t("settings.saved"));
      } else toast.error(t("settings.saveFailed"));
    });
  }

  function reset() {
    startTransition(async () => {
      const res = await resetPricingDefaults();
      setConfirmOpen(false);
      if (res.ok) {
        const fresh = formFromSettings(DEFAULT_PRICING_SETTINGS);
        setForm(fresh);
        setBaseline(JSON.stringify(fresh));
        setUsingBuiltIn(true);
        setResetKey((k) => k + 1);
        toast.success(t("settings.resetDone"));
      } else toast.error(t("settings.resetFailed"));
    });
  }

  const update = (fn: (f: PricingForm) => PricingForm) => setForm(fn);

  return (
    <section id="pricing" className="card-surface scroll-mt-20 space-y-5 rounded-xl p-5">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{tc("settings.pricing")}</h2>
        <p className="text-sm text-muted-foreground">{t("settings.intro")}</p>
        {usingBuiltIn ? <p className="text-xs text-warning">{t("settings.usingBuiltIn")}</p> : null}
      </div>

      <div className="space-y-5">
        <fieldset className="min-w-0 space-y-2">
          <legend className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t("groups.target")}
          </legend>
          <TargetEditor form={form} update={update} errors={errors} defaults={settings} mode="settings" idPrefix="pd" resetKey={resetKey} />
        </fieldset>
        <PricingFieldGroups
          groups={GROUPS}
          form={form}
          update={update}
          errors={errors}
          defaults={settings}
          mode="settings"
          idPrefix="pd"
          resetKey={resetKey}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={!valid || pending || !dirty}>
          {pending ? tc("actions.saving") : tc("actions.save")}
        </Button>
        <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)} disabled={pending || usingBuiltIn}>
          {t("settings.reset")}
        </Button>
        {dirty ? <span className="text-xs text-muted-foreground">{t("settings.unsaved")}</span> : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("settings.productsHint")}{" "}
        <Link href="/app/products" className="underline underline-offset-2 hover:text-foreground">
          {tc("products.title")}
        </Link>
      </p>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.resetTitle")}</DialogTitle>
            <DialogDescription>{t("settings.resetBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
              {tc("actions.cancel")}
            </Button>
            <Button type="button" variant="destructive" onClick={reset} disabled={pending}>
              {t("settings.resetConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
