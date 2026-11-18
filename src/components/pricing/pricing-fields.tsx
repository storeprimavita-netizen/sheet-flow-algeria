"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";

import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EnumSelect } from "@/components/fields/enum-select";
import { NumberField } from "@/components/fields/number-field";
import { PercentField } from "@/components/fields/percent-field";
import {
  PRICING_FIELDS,
  ROUNDING_OPTIONS,
  overridesFromForm,
  toPercent,
  type FieldDef,
  type FieldGroup,
  type FieldKey,
  type FormErrors,
  type PricingForm,
} from "@/lib/pricing-form";
import type { PricingSettings, Rounding } from "@/lib/pricing-v2";
import { MAX_MARKUP } from "@/lib/pricing-v2";

/** Display-only unit per field (message key under `unit.`). */
const UNIT: Partial<Record<FieldKey, "dzd" | "usd" | "times">> = {
  officialRate: "dzd",
  parallelRate: "dzd",
  platformMonthlyUsd: "usd",
  months: "times",
  packaging: "dzd",
  confirmationFee: "dzd",
  otherPerOrder: "dzd",
  returnCost: "dzd",
  otherStockFees: "dzd",
  "adMultiplier.best": "times",
  "adMultiplier.worst": "times",
};

export type FormUpdate = (fn: (f: PricingForm) => PricingForm) => void;

function defaultFor(def: FieldDef, defaults: PricingSettings): number {
  const [a, b] = def.key.split(".");
  const top = (defaults as unknown as Record<string, unknown>)[a];
  const v = (b === undefined ? top : (top as Record<string, number>)[b]) as number;
  return def.pct ? toPercent(v) : v;
}

const INHERIT = "__inherit__";

/** Groups of fields (target excluded: see TargetEditor). */
export function PricingFieldGroups({
  groups,
  form,
  update,
  errors,
  defaults,
  mode,
  idPrefix,
  resetKey = 0,
}: {
  groups: readonly FieldGroup[];
  form: PricingForm;
  update: FormUpdate;
  errors: FormErrors;
  defaults: PricingSettings;
  /** settings: every field required. override: empty inherits, shows the default as a hint. */
  mode: "settings" | "override";
  idPrefix: string;
  /** bump to remount every input (parent reset) */
  resetKey?: number;
}) {
  const t = useTranslations("pricingV2");
  const [gens, setGens] = React.useState<Record<string, number>>({});
  const override = mode === "override";

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <fieldset key={g} className="min-w-0 space-y-2">
          <legend className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {t(`groups.${g}`)}
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRICING_FIELDS.filter((f) => f.group === g).map((f) => {
              const id = `${idPrefix}-${f.key}`;
              const err = errors[f.key];
              const label = t(`fields.${f.key}`);
              const dflt = defaultFor(f, defaults);
              const dfltText = f.pct ? `${dflt}%` : `${dflt}`;
              const value = form.values[f.key];
              const overridden = override && value !== null;
              const set = (v: number | null) => update((cur) => ({ ...cur, values: { ...cur.values, [f.key]: v } }));
              const key = `${f.key}-${resetKey}-${gens[f.key] ?? 0}`;
              const common = {
                id,
                invalid: !!err,
                describedBy: err ? `${id}-err` : undefined,
                placeholder: override ? t("field.default", { value: dfltText }) : undefined,
                onChange: set,
              };
              return (
                <div key={f.key} className="min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor={id} className="text-xs text-muted-foreground">
                      {label}
                    </label>
                    {overridden ? (
                      <span className="flex items-center gap-1">
                        <Chip token="info" size="sm">
                          {t("field.overridden")}
                        </Chip>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label={t("field.reset", { field: label })}
                          title={t("field.reset", { field: label })}
                          onClick={() => {
                            set(null);
                            setGens((s) => ({ ...s, [f.key]: (s[f.key] ?? 0) + 1 }));
                          }}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5">
                    {f.pct ? (
                      <PercentField key={key} {...common} defaultValue={value} nullable decimals={2} max={100} />
                    ) : (
                      <NumberField key={key} {...common} defaultValue={value} unit={UNIT[f.key] ? t(`unit.${UNIT[f.key]}`) : undefined} />
                    )}
                  </div>
                  {err ? (
                    <p id={`${id}-err`} className="mt-1 text-xs text-destructive">
                      {t(`field.${err}`)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

/** Target (profit/piece DZD | markup % of product cost) + price rounding. */
export function TargetEditor({
  form,
  update,
  errors,
  defaults,
  mode,
  idPrefix,
  liveProfit,
  resetKey = 0,
}: {
  form: PricingForm;
  update: FormUpdate;
  errors: FormErrors;
  defaults: PricingSettings;
  mode: "settings" | "override";
  idPrefix: string;
  /** product editor: the engine's target profit per piece, already formatted ("—" when cost is missing) */
  liveProfit?: React.ReactNode;
  resetKey?: number;
}) {
  const t = useTranslations("pricingV2");
  const [gen, setGen] = React.useState(0);
  const override = mode === "override";
  const err = errors.target;
  const sameMode = form.targetMode === defaults.target.mode;
  const dv = defaults.target.value;
  const dfltText =
    override && sameMode && dv !== null
      ? form.targetMode === "markup"
        ? t("target.defaultMarkup", { value: toPercent(dv) })
        : t("target.defaultProfit", { value: dv })
      : undefined;
  const overridden = override && overridesFromForm(form, defaults).target !== undefined;
  const id = `${idPrefix}-target`;
  const valueKey = `${form.targetMode}-${resetKey}-${gen}`;
  const setValue = (v: number | null) => update((cur) => ({ ...cur, targetValue: v }));

  const roundingOptions = [
    ...(override ? [{ value: INHERIT, label: t("rounding.inherit") }] : []),
    ...ROUNDING_OPTIONS.map((r) => ({ value: r, label: t(`rounding.${r}`) })),
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 sm:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <span id={`${id}-label`} className="text-xs text-muted-foreground">
              {t("target.label")}
            </span>
            {overridden ? (
              <span className="flex items-center gap-1">
                <Chip token="info" size="sm">
                  {t("field.overridden")}
                </Chip>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  aria-label={t("field.reset", { field: t("target.label") })}
                  title={t("field.reset", { field: t("target.label") })}
                  onClick={() => {
                    update((cur) => ({ ...cur, targetMode: defaults.target.mode, targetValue: null }));
                    setGen((g) => g + 1);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-labelledby={`${id}-label`} className="inline-flex rounded-md border border-input p-0.5">
              {(["profit", "markup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={form.targetMode === m}
                  onClick={() => {
                    if (form.targetMode === m) return;
                    // switching mode resets the value: DZD and percent are never reinterpreted
                    update((cur) => ({ ...cur, targetMode: m, targetValue: null }));
                    setGen((g) => g + 1);
                  }}
                  className={`rounded px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                    form.targetMode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`target.${m}`)}
                </button>
              ))}
            </div>
            <div className="w-40">
              {form.targetMode === "markup" ? (
                <PercentField
                  key={valueKey}
                  id={id}
                  nullable
                  decimals={2}
                  max={MAX_MARKUP * 100}
                  defaultValue={form.targetValue}
                  placeholder={dfltText}
                  invalid={!!err}
                  describedBy={err ? `${id}-err` : undefined}
                  aria-label={t("target.markup")}
                  onChange={setValue}
                />
              ) : (
                <NumberField
                  key={valueKey}
                  id={id}
                  unit={t("unit.dzd")}
                  defaultValue={form.targetValue}
                  placeholder={dfltText}
                  invalid={!!err}
                  describedBy={err ? `${id}-err` : undefined}
                  aria-label={t("target.profit")}
                  onChange={setValue}
                />
              )}
            </div>
            {liveProfit !== undefined ? (
              <span className="text-xs text-muted-foreground">{liveProfit}</span>
            ) : !override ? (
              <span className="text-xs text-muted-foreground">{t("target.settingsHint")}</span>
            ) : null}
          </div>
          {err ? (
            <p id={`${id}-err`} className="mt-1 text-xs text-destructive">
              {t(`field.${err}`)}
            </p>
          ) : override && form.targetValue === null && form.targetMode !== defaults.target.mode ? (
            <p className="mt-1 text-xs text-warning">{t("target.needsValue")}</p>
          ) : null}
        </div>
        <Field label={t("rounding.label")} htmlFor={`${idPrefix}-rounding`}>
          <EnumSelect
            key={`rounding-${resetKey}`}
            id={`${idPrefix}-rounding`}
            options={roundingOptions}
            defaultValue={form.rounding ?? (override ? INHERIT : defaults.rounding)}
            onChange={(v) => update((cur) => ({ ...cur, rounding: v === INHERIT ? null : (v as Rounding) }))}
            className="w-full"
          />
        </Field>
      </div>
    </div>
  );
}
