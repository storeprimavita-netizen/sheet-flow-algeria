"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { NumberField } from "@/components/fields/number-field";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { comparePrice, unitPrice, type PricingMode } from "@/lib/store/offer-price";

import { savePricing } from "../actions";
import { SaveBar, type SaveState } from "./save-bar";

type Option = { id: string; name: string; values: { id: string; label: string; delta: number }[] };
type Variant = { id: string; label: string; valueIds: string[]; override: number | null; compareOverride: number | null };

const MODES: PricingMode[] = ["uniform", "per_value", "per_variant"];

export function PricingEditor({
  productId,
  salePrice,
  mode: initialMode,
  compareAt: initialCompare,
  options,
  variants,
}: {
  productId: string;
  salePrice: number | null;
  mode: PricingMode;
  compareAt: number | null;
  options: Option[];
  variants: Variant[];
}) {
  const t = useTranslations("store.admin.selling");
  const hasSizes = variants.length > 0;
  const [mode, setMode] = React.useState<PricingMode>(hasSizes ? initialMode : "uniform");
  const [compareAt, setCompareAt] = React.useState<number | null>(initialCompare);
  const [deltas, setDeltas] = React.useState<Record<string, number>>(() => Object.fromEntries(options.flatMap((o) => o.values.map((v) => [v.id, v.delta]))));
  const [overrides, setOverrides] = React.useState<Record<string, { price: number | null; compare: number | null }>>(() =>
    Object.fromEntries(variants.map((v) => [v.id, { price: v.override, compare: v.compareOverride }])),
  );
  const [state, setState] = React.useState<SaveState>({ kind: "idle" });
  const [dirty, setDirty] = React.useState(false);
  const [rk, setRk] = React.useState(0); // remount the uncontrolled number fields after a reset
  const touch = () => {
    setDirty(true);
    setState((s) => (s.kind === "saved" ? { kind: "idle" } : s));
  };

  const hasDeltas = Object.values(deltas).some((d) => d !== 0);
  const hasOverrides = Object.values(overrides).some((o) => o.price !== null || o.compare !== null);

  function pick(next: PricingMode) {
    if (next === mode) return;
    const losing = (mode === "per_value" && hasDeltas) || (mode === "per_variant" && hasOverrides);
    if (losing && !window.confirm(t("pricing.confirmDiscard"))) return;
    if (mode === "per_value") setDeltas((d) => Object.fromEntries(Object.keys(d).map((k) => [k, 0])));
    if (mode === "per_variant") setOverrides((o) => Object.fromEntries(Object.keys(o).map((k) => [k, { price: null, compare: null }])));
    setRk((n) => n + 1);
    setMode(next);
    touch();
  }

  const rows = variants.map((v) => {
    const input = {
      mode,
      basePrice: salePrice ?? 0,
      compareAt,
      valueDeltas: v.valueIds.map((id) => deltas[id] ?? 0),
      override: overrides[v.id]?.price ?? null,
      compareOverride: overrides[v.id]?.compare ?? null,
    };
    const price = salePrice === null ? null : unitPrice(input);
    return { v, price, compare: comparePrice(input, price) };
  });

  async function save() {
    setState({ kind: "saving" });
    const res = await savePricing({
      productId,
      mode,
      compareAt,
      deltas: Object.entries(deltas).map(([valueId, delta]) => ({ valueId, delta: mode === "per_value" ? delta : 0 })),
      overrides: variants.map((v) => ({
        variantId: v.id,
        price: mode === "per_variant" ? (overrides[v.id]?.price ?? null) : null,
        compareAt: mode === "per_variant" ? (overrides[v.id]?.compare ?? null) : null,
      })),
    });
    if (res.ok) {
      setState({ kind: "saved" });
      setDirty(false);
    } else setState({ kind: "error", reason: t(`errors.${res.error}`) });
  }

  return (
    <section className="card-surface space-y-4 rounded-xl p-5" aria-labelledby="pricing-title">
      <div className="space-y-1">
        <h3 id="pricing-title" className="text-sm font-semibold">{t("pricing.title")}</h3>
        <p className="text-xs text-muted-foreground">
          {salePrice === null ? t("pricing.noBase") : t("pricing.base", { price: formatCurrency(salePrice, "DZD") })}
        </p>
      </div>

      <div role="group" aria-label={t("pricing.modeLabel")} className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const off = !hasSizes && m !== "uniform";
          return (
            <Button key={m} type="button" size="sm" variant={mode === m ? "default" : "outline"} aria-pressed={mode === m} disabled={off} onClick={() => pick(m)}>
              {t(`pricing.mode.${m}`)}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{hasSizes ? t(`pricing.modeHint.${mode}`) : t("pricing.noSizes")}</p>

      <div className="max-w-xs space-y-1.5">
        <label htmlFor="compare-at" className="text-xs text-muted-foreground">{t("pricing.compareAt")}</label>
        <NumberField
          id="compare-at"
          integer
          unit="DZD"
          defaultValue={initialCompare}
          onChange={(v) => {
            setCompareAt(v === null || !Number.isFinite(v) ? null : v);
            touch();
          }}
        />
        <p className="text-xs text-muted-foreground">{t("pricing.compareHint")}</p>
      </div>

      {hasSizes ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs text-muted-foreground">
                <th className="px-2 py-2 text-start font-medium">{t("pricing.colSize")}</th>
                {mode === "per_variant" ? <th className="px-2 py-2 text-start font-medium">{t("pricing.colOverride")}</th> : null}
                {mode === "per_variant" ? <th className="px-2 py-2 text-start font-medium">{t("pricing.colCompare")}</th> : null}
                <th className="px-2 py-2 text-end font-medium">{t("pricing.colPrice")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, price, compare }) => (
                <tr key={v.id} className="border-t border-border">
                  <td className="px-2 py-2"><bdi>{v.label}</bdi></td>
                  {mode === "per_variant" ? (
                    <>
                      <td className="w-40 px-2 py-2">
                        <NumberField key={`o-${v.id}-${rk}`} integer unit="DZD" aria-label={t("pricing.overrideFor", { label: v.label })} defaultValue={overrides[v.id]?.price ?? null} placeholder={salePrice === null ? "" : String(salePrice)}
                          onChange={(n) => { setOverrides((o) => ({ ...o, [v.id]: { ...o[v.id], price: n !== null && Number.isFinite(n) ? n : null } })); touch(); }} />
                      </td>
                      <td className="w-40 px-2 py-2">
                        <NumberField key={`c-${v.id}-${rk}`} integer unit="DZD" aria-label={t("pricing.compareOverrideFor", { label: v.label })} defaultValue={overrides[v.id]?.compare ?? null}
                          onChange={(n) => { setOverrides((o) => ({ ...o, [v.id]: { ...o[v.id], compare: n !== null && Number.isFinite(n) ? n : null } })); touch(); }} />
                      </td>
                    </>
                  ) : null}
                  <td className="num px-2 py-2 text-end" dir="ltr">
                    {price === null ? (
                      <span className="text-danger">{t("pricing.notSellable")}</span>
                    ) : (
                      <>
                        {compare !== null ? <s className="me-2 text-xs text-muted-foreground">{formatCurrency(compare, "DZD")}</s> : null}
                        {formatCurrency(price, "DZD")}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {mode === "per_value" ? (
        <div className="space-y-3">
          {options.map((o) => (
            <fieldset key={o.id} className="space-y-2">
              <legend className="text-xs font-medium text-muted-foreground">{o.name}</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {o.values.map((val) => (
                  <label key={val.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm">
                    <bdi className="min-w-0 truncate">{val.label}</bdi>
                    <NumberField key={`d-${val.id}-${rk}`} className="w-32" integer allowNegative unit="DZD" aria-label={t("pricing.deltaFor", { label: val.label })} defaultValue={deltas[val.id] ?? 0}
                      onChange={(n) => { setDeltas((d) => ({ ...d, [val.id]: n !== null && Number.isFinite(n) ? n : 0 })); touch(); }} />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      ) : null}

      <SaveBar state={state} dirty={dirty} onSave={save} />
    </section>
  );
}
