import { getTranslations } from "next-intl/server";

import { MEETING_SLOT_COUNT, type SettingValue } from "@/lib/settings";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { saveThresholds } from "./actions";

const DOW = [0, 1, 2, 3, 4, 5, 6] as const;

export async function ThresholdsSection({
  returnFee,
  duplicateWindow,
  riskWeights,
  stopShippingRule,
  meetingSchedule,
}: {
  returnFee: SettingValue<"return_fee">;
  duplicateWindow: SettingValue<"duplicate_window">;
  riskWeights: SettingValue<"risk_weights">;
  stopShippingRule: SettingValue<"stop_shipping_rule">;
  meetingSchedule: SettingValue<"meeting_schedule">;
}) {
  const t = await getTranslations();
  const slots = Array.from({ length: MEETING_SLOT_COUNT }, (_, i) => meetingSchedule.slots[i] ?? null);

  return (
    <section className="card-surface space-y-6 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.thresholds")}</h2>
      <form action={saveThresholds} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t("settings.returnFee")}>
            <Input name="return_fee_amount" type="number" step="0.01" min="0" defaultValue={returnFee.amount} />
          </Field>
          <Field label={t("settings.duplicateWindowHours")}>
            <Input
              name="duplicate_window_hours"
              type="number"
              step="1"
              min="1"
              defaultValue={duplicateWindow.hours}
            />
          </Field>
          <Field label={t("settings.minOrders")}>
            <Input name="min_orders" type="number" step="1" min="0" defaultValue={stopShippingRule.min_orders} />
          </Field>
          <Field label={t("settings.minDeliveryRate")}>
            <Input
              name="min_delivery_rate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              defaultValue={stopShippingRule.min_delivery_rate}
            />
          </Field>
          <Field label={t("settings.riskReturned")}>
            <Input name="risk_returned" type="number" step="0.1" min="0" defaultValue={riskWeights.returned} />
          </Field>
          <Field label={t("settings.riskCancelled")}>
            <Input name="risk_cancelled" type="number" step="0.1" min="0" defaultValue={riskWeights.cancelled} />
          </Field>
          <Field label={t("settings.riskNoAnswer")}>
            <Input name="risk_no_answer" type="number" step="0.1" min="0" defaultValue={riskWeights.no_answer} />
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("settings.meetingSchedule")} — {t("settings.meetingHint")}
          </p>
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select name={`slot_dow_${i}`} defaultValue={String(s?.dow ?? 1)} className="w-40">
                {DOW.map((d) => (
                  <option key={d} value={d}>
                    {t(`settings.dow.${d}`)}
                  </option>
                ))}
              </Select>
              <Input name={`slot_time_${i}`} type="time" defaultValue={s?.time ?? ""} className="w-32" />
            </div>
          ))}
        </div>

        <Button type="submit">{t("actions.save")}</Button>
      </form>
    </section>
  );
}
