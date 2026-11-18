"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Empty } from "@/components/empty";
import { ButtonLink } from "@/components/button-link";
import { Field } from "@/components/field";
import { NumberField } from "@/components/fields/number-field";
import { formatCurrency } from "@/lib/format";
import { stockCostTotal } from "@/lib/pricing-form";
import { computeAll, type DeepPartial, type PricingSettings } from "@/lib/pricing-v2";
import { PricingResults } from "./pricing-results";

export type SavedPricing = {
  overrides: DeepPartial<PricingSettings>;
  adBest: number | null;
  adMedium: number | null;
  adWorst: number | null;
  finalPrice: number | null;
};

export function PricingCalculator({
  productId,
  defaults,
  perPieceCost,
  stock,
  saved,
}: {
  productId: string;
  defaults: PricingSettings;
  perPieceCost: number | null;
  stock: number;
  saved: SavedPricing;
}) {
  const t = useTranslations("pricingV2");
  const [quantity, setQuantity] = React.useState<number | null>(stock);

  const qty = quantity ?? 0;
  // sourcing_cost_dzd is PER PIECE; the engine wants the TOTAL and divides by sellable quantity itself
  const total = stockCostTotal(perPieceCost, qty);
  const results = React.useMemo(
    () =>
      computeAll(defaults, {
        stockCostDzd: total ?? Number.NaN,
        quantity: qty,
        adCostUsd: { best: saved.adBest, medium: saved.adMedium, worst: saved.adWorst },
        finalPrice: saved.finalPrice,
        overrides: saved.overrides,
      }),
    [defaults, total, qty, saved],
  );
  const hasCost = perPieceCost !== null && perPieceCost > 0;

  return (
    <div className="space-y-6">
      <section className="card-surface space-y-4 rounded-xl p-4" aria-labelledby="pp-inputs">
        <h3 id="pp-inputs" className="text-sm font-semibold">
          {t("product.inputs")}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t("product.quantity")} htmlFor="pp-quantity">
            <NumberField
              id="pp-quantity"
              defaultValue={stock}
              describedBy="pp-quantity-hint"
              onChange={(v) => setQuantity(v === null ? null : Math.floor(v))}
            />
            <p id="pp-quantity-hint" className="mt-1 text-xs text-muted-foreground">
              {t("product.quantityHint")}
            </p>
          </Field>
          {hasCost ? (
            <div className="text-sm">
              <div className="text-xs text-muted-foreground">
                {t("product.stockCost", { value: total === null ? "—" : formatCurrency(total) })}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("product.stockCostHint", { perPiece: formatCurrency(perPieceCost), quantity: qty })}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {hasCost ? (
        <PricingResults results={results} />
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
