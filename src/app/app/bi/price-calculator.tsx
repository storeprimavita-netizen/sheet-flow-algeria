"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { formatCurrency } from "@/lib/format";

const COSTS = [
  "cost_shooting",
  "cost_packaging",
  "cost_sampling",
  "cost_confirmation",
  "cost_delivery",
  "cost_test_ads",
  "cost_scaling_ads",
] as const;

export function PriceCalculator() {
  const t = useTranslations();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [margin, setMargin] = useState("30");

  const totalCost = COSTS.reduce((sum, k) => sum + (Number(vals[k]) || 0), 0);
  const m = Number(margin) || 0;
  const price = totalCost === 0 ? 0 : totalCost * (1 + m / 100);
  const profit = price - totalCost;

  return (
    <div className="glass-card space-y-4 rounded-xl p-5">
      <div>
        <h2 className="text-sm font-semibold">{t("bi.calculator")}</h2>
        <p className="text-xs text-muted-foreground">{t("bi.calculatorHint")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {COSTS.map((k) => {
          const category = k.replace("cost_", "");
          return (
            <Field key={k} label={t(`status.expense_category.${category}`)} htmlFor={k}>
              <Input
                id={k}
                type="number"
                min="0"
                step="0.01"
                value={vals[k] ?? ""}
                onChange={(e) => setVals((v) => ({ ...v, [k]: e.target.value }))}
              />
            </Field>
          );
        })}
        <Field label={t("bi.margin")} htmlFor="margin">
          <Input
            id="margin"
            type="number"
            min="0"
            step="1"
            value={margin}
            onChange={(e) => setMargin(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">{t("bi.totalCost")}</div>
          <div className="font-medium">{formatCurrency(totalCost)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("bi.profit")}</div>
          <div className="font-medium text-success">{formatCurrency(profit)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{t("bi.suggestedPrice")}</div>
          <div className="font-bold text-gradient">{formatCurrency(price)}</div>
        </div>
      </div>
    </div>
  );
}
