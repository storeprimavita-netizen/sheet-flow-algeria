import { getTranslations } from "next-intl/server";

import type { SettingValue } from "@/lib/settings";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MoneyField } from "@/components/fields/money-field";
import { PercentField } from "@/components/fields/percent-field";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { saveEngineRules } from "./actions";

export async function EngineRulesSection({
  returnFee,
  duplicateWindow,
  riskWeights,
  stopShippingRule,
}: {
  returnFee: SettingValue<"return_fee">;
  duplicateWindow: SettingValue<"duplicate_window">;
  riskWeights: SettingValue<"risk_weights">;
  stopShippingRule: SettingValue<"stop_shipping_rule">;
}) {
  const t = await getTranslations();

  return (
    <section id="engine-rules" className="card-surface scroll-mt-20 space-y-6 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.engineRules")}</h2>
      <form action={saveEngineRules} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("settings.returnFee")}>
          <MoneyField name="return_fee_amount" defaultValue={returnFee.amount} />
        </Field>
        <Field label={t("settings.duplicateWindowHours")}>
          <QuantityStepper name="duplicate_window_hours" defaultValue={duplicateWindow.hours} min={1} max={9999} />
        </Field>
        <Field label={t("settings.minOrders")}>
          <QuantityStepper name="min_orders" defaultValue={stopShippingRule.min_orders} min={0} max={9999} />
        </Field>
        <Field label={t("settings.minDeliveryRate")}>
          <PercentField name="min_delivery_rate" defaultValue={stopShippingRule.min_delivery_rate} />
        </Field>
        <Field label={t("settings.riskReturned")}>
          <Input
            name="risk_returned"
            type="number"
            step="0.1"
            min="0"
            defaultValue={riskWeights.returned}
            className="num text-end"
          />
        </Field>
        <Field label={t("settings.riskCancelled")}>
          <Input
            name="risk_cancelled"
            type="number"
            step="0.1"
            min="0"
            defaultValue={riskWeights.cancelled}
            className="num text-end"
          />
        </Field>
        <Field label={t("settings.riskNoAnswer")}>
          <Input
            name="risk_no_answer"
            type="number"
            step="0.1"
            min="0"
            defaultValue={riskWeights.no_answer}
            className="num text-end"
          />
        </Field>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button type="submit">{t("actions.save")}</Button>
        </div>
      </form>
    </section>
  );
}
