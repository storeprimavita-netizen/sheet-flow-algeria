"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown } from "lucide-react";

import { Empty } from "@/components/empty";
import { ButtonLink } from "@/components/button-link";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field } from "@/components/field";
import { NumberField } from "@/components/fields/number-field";
import { PricingFieldGroups, TargetEditor } from "@/components/pricing/pricing-fields";
import { formatCurrency, formatInt } from "@/lib/format";
import {
  MAX_AD_USD,
  MAX_FINAL_PRICE,
  countOverrides,
  formErrors,
  formFromOverrides,
  overridesFromForm,
  saleBelowBreakEven,
  stockCostTotal,
  type PricingForm,
} from "@/lib/pricing-form";
import type { Kpi } from "@/lib/kpi";
import { realScenarioInput } from "@/lib/pricing-real";
import { computeAll, computeScenario, resolveSettings, scenarioInputs, type DeepPartial, type PricingSettings } from "@/lib/pricing-v2";
import { saveProductPricing } from "./actions";
import { PricingResults } from "./pricing-results";

export type SavedPricing = {
  overrides: DeepPartial<PricingSettings>;
  adBest: number | null;
  adMedium: number | null;
  adWorst: number | null;
  finalPrice: number | null;
};

type Draft = {
  quantity: number | null;
  form: PricingForm;
  adBest: number | null;
  adMedium: number | null;
  adWorst: number | null;
  finalPrice: number | null;
};

const centsOk = (v: number) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6;
const adOk = (v: number | null) => v === null || (v >= 0 && v <= MAX_AD_USD && centsOk(v));
export const MAX_QUANTITY = 1_000_000;
const qtyOk = (v: number | null) => v !== null && Number.isInteger(v) && v >= 0 && v <= MAX_QUANTITY;
const priceOk = (v: number | null) => v === null || (v > 0 && v <= MAX_FINAL_PRICE && centsOk(v));
/** Quantity only drives the table; it is never saved, so it stays out of dirty/save checks. */
const saveSnapshot = (d: Draft) => JSON.stringify({ ...d, quantity: null });

export function PricingCalculator({
  productId,
  defaults,
  perPieceCost,
  stock,
  salePrice,
  realKpi,
  saved,
}: {
  productId: string;
  defaults: PricingSettings;
  perPieceCost: number | null;
  stock: number;
  salePrice: number | null;
  realKpi: Kpi | null;
  saved: SavedPricing;
}) {
  const t = useTranslations("pricingV2");
  const [draft, setDraft] = React.useState<Draft>(() => ({
    quantity: stock,
    form: formFromOverrides(saved.overrides, defaults),
    adBest: saved.adBest,
    adMedium: saved.adMedium,
    adWorst: saved.adWorst,
    finalPrice: saved.finalPrice,
  }));
  const [baseline, setBaseline] = React.useState(() => saveSnapshot(draft));
  const [pending, startTransition] = React.useTransition();

  const errors = formErrors(draft.form, false, defaults.target.mode);
  const priceErr = !priceOk(draft.finalPrice);
  const qtyErr = !qtyOk(draft.quantity);
  const adErr = { best: !adOk(draft.adBest), medium: !adOk(draft.adMedium), worst: !adOk(draft.adWorst) };
  const saveValid = Object.keys(errors).length === 0 && !priceErr && !adErr.best && !adErr.medium && !adErr.worst;
  const valid = saveValid && !qtyErr;
  const dirty = saveSnapshot(draft) !== baseline;
  const dzd = t("unit.dzd");

  const overrides = React.useMemo(() => overridesFromForm(draft.form, defaults), [draft.form, defaults]);

  // Invalid input keeps the last valid table: `applied` only follows valid drafts.
  const toApplied = (d: Draft) => ({
    quantity: d.quantity ?? 0,
    overrides: overridesFromForm(d.form, defaults),
    ads: { best: d.adBest, medium: d.adMedium, worst: d.adWorst },
    finalPrice: d.finalPrice,
  });
  const [applied, setApplied] = React.useState(() => toApplied(draft));
  if (valid) {
    const next = toApplied(draft);
    if (JSON.stringify(next) !== JSON.stringify(applied)) setApplied(next);
  }

  // sourcing_cost_dzd is PER PIECE; the engine wants the TOTAL and divides by sellable quantity itself
  const total = stockCostTotal(perPieceCost, applied.quantity);
  const results = React.useMemo(
    () =>
      computeAll(defaults, {
        stockCostDzd: total ?? Number.NaN,
        quantity: applied.quantity,
        adCostUsd: applied.ads,
        finalPrice: applied.finalPrice,
        overrides: applied.overrides,
      }),
    [defaults, total, applied],
  );
  // Real column: same merged settings, stock cost, quantity and final-price rule as the scenarios
  const real = React.useMemo(() => {
    const settings = resolveSettings(defaults, applied.overrides);
    const scenario = realScenarioInput(realKpi, settings.parallelRate);
    const result = computeScenario(
      settings,
      { stockCostDzd: total ?? Number.NaN, quantity: applied.quantity },
      scenario.input,
      applied.finalPrice,
      results.medium.recommendedPrice,
    );
    return {
      result,
      input: scenario.input,
      adCostDzd: scenario.adCostDzd,
      rate: settings.parallelRate,
      hasData: scenario.hasData,
      matured: scenario.matured,
    };
  }, [defaults, applied, total, realKpi, results.medium.recommendedPrice]);
  const inputs = React.useMemo(
    () => scenarioInputs(resolveSettings(defaults, applied.overrides), applied.ads),
    [defaults, applied],
  );
  const hasCost = perPieceCost !== null && perPieceCost > 0;

  const update = (fn: (f: PricingForm) => PricingForm) => setDraft((d) => ({ ...d, form: fn(d.form) }));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function save() {
    if (!saveValid) return;
    startTransition(async () => {
      const res = await saveProductPricing({
        productId,
        overrides,
        adBestUsd: draft.adBest,
        adMediumUsd: draft.adMedium,
        adWorstUsd: draft.adWorst,
        finalPrice: draft.finalPrice,
      });
      if (res.ok) {
        setBaseline(saveSnapshot(draft));
        toast.success(t("product.saved"));
      } else toast.error(t("product.saveFailed"));
    });
  }

  const liveProfit = t("target.live", {
    value: errors.target || results.medium.targetProfit === null ? "—" : formatCurrency(results.medium.targetProfit, dzd),
  });
  const overrideCount = countOverrides(overrides);
  const qty = draft.quantity ?? 0;
  const recommended = results.medium.recommendedPrice;
  const minPrice = results.medium.breakEven.minSellingPrice;
  const belowBreakEven = saleBelowBreakEven(salePrice, minPrice);
  const adField = (key: "adBest" | "adMedium" | "adWorst", label: string, hint?: string) => (
    <Field label={label} htmlFor={`pp-${key}`}>
      <NumberField
        id={`pp-${key}`}
        unit={t("unit.usd")}
        defaultValue={draft[key]}
        placeholder={hint}
        invalid={adErr[key.slice(2).toLowerCase() as "best" | "medium" | "worst"]}
        describedBy={adErr[key.slice(2).toLowerCase() as "best" | "medium" | "worst"] ? `pp-${key}-err` : undefined}
        onChange={(v) => set(key, v)}
      />
      {adErr[key.slice(2).toLowerCase() as "best" | "medium" | "worst"] ? (
        <p id={`pp-${key}-err`} className="mt-1 text-xs text-destructive">
          {t("product.adInvalid")}
        </p>
      ) : null}
    </Field>
  );

  return (
    <div className="space-y-6">
      <section className="card-surface space-y-4 rounded-xl p-4" aria-labelledby="pp-inputs">
        <h3 id="pp-inputs" className="text-sm font-semibold">
          {t("product.inputs")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("product.quantity")} htmlFor="pp-quantity">
            <NumberField
              id="pp-quantity"
              defaultValue={stock}
              invalid={qtyErr}
              describedBy="pp-quantity-hint"
              onChange={(v) => set("quantity", v)}
            />
            <p id="pp-quantity-hint" className="mt-1 text-xs text-muted-foreground">
              {qtyErr ? <span className="text-destructive">{t("product.quantityInvalid")} </span> : null}
              {t("product.quantityHint")}
            </p>
          </Field>
          {hasCost ? (
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">
                {t("product.stockCost", { value: qtyErr || total === null ? "—" : formatCurrency(total, dzd) })}
              </div>
              {qtyErr ? null : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("product.stockCostHint", { perPiece: formatCurrency(perPieceCost, dzd), quantity: qty })}
                </p>
              )}
            </div>
          ) : null}
          <Field label={t("product.finalPrice")} htmlFor="pp-final">
            <NumberField
              id="pp-final"
              unit={dzd}
              defaultValue={draft.finalPrice}
              placeholder={recommended === null ? undefined : formatInt(recommended)}
              invalid={priceErr}
              describedBy="pp-final-hint"
              onChange={(v) => set("finalPrice", v)}
            />
            <p id="pp-final-hint" className="mt-1 text-xs text-muted-foreground">
              {priceErr ? <span className="text-destructive">{t("product.priceInvalid")} </span> : null}
              {t("product.finalPriceHint", { sale: salePrice === null ? "—" : formatCurrency(salePrice, dzd) })}
            </p>
            {belowBreakEven && minPrice !== null ? (
              <Chip token="danger" size="sm" className="mt-1" icon={<AlertTriangle className="h-3.5 w-3.5" aria-hidden />}>
                {t("product.saleBelowBreakEven", { value: formatCurrency(Math.ceil(minPrice), dzd) })}
              </Chip>
            ) : null}
          </Field>
          {adField("adMedium", t("product.adMedium"))}
          {adField("adBest", t("product.adBest"), t("product.adDerived"))}
          {adField("adWorst", t("product.adWorst"), t("product.adDerived"))}
        </div>
        <TargetEditor
          form={draft.form}
          update={update}
          errors={errors}
          defaults={defaults}
          mode="override"
          idPrefix="pp"
          liveProfit={liveProfit}
        />

        <details className="group rounded-lg border border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
            {t("product.advanced")}
            <Chip token={overrideCount ? "info" : "neutral"} size="sm">
              {overrideCount ? t("product.advancedCount", { count: overrideCount }) : t("product.advancedNone")}
            </Chip>
            <Link
              href="/app/settings?section=pricing"
              className="ms-auto text-xs font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
            >
              {t("product.settingsLink")}
            </Link>
          </summary>
          <div className="border-t border-border p-3">
            <PricingFieldGroups
              groups={["funnel", "ads", "platform", "perOrder", "stock", "rates"]}
              form={draft.form}
              update={update}
              errors={errors}
              defaults={defaults}
              mode="override"
              idPrefix="pp"
            />
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={!saveValid || pending || !dirty}>
            {pending ? t("product.saving") : t("product.save")}
          </Button>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {!saveValid ? <span className="text-destructive">{t("product.invalid")}</span> : dirty ? t("product.unsaved") : null}
          </span>
        </div>
      </section>

      {hasCost ? (
        <PricingResults results={results} inputs={inputs} real={real} unit={dzd} />
      ) : (
        <Empty className="space-y-3">
          <p className="font-medium text-foreground">{t("product.emptyTitle")}</p>
          <p>{t("product.emptyBody")}</p>
          <ButtonLink href={`/app/products/${productId}`} variant="outline" size="sm">
            {t("product.emptyAction")}
          </ButtonLink>
        </Empty>
      )}
    </div>
  );
}
