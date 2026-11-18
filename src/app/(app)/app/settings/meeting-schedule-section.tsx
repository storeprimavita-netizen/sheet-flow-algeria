import { getTranslations } from "next-intl/server";

import { MEETING_SLOT_COUNT, type SettingValue } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { EnumSelect } from "@/components/fields/enum-select";
import { TimeField } from "@/components/fields/date-field";
import { saveMeetingSchedule } from "./actions";

const DOW = [0, 1, 2, 3, 4, 5, 6] as const;

export async function MeetingScheduleSection({
  meetingSchedule,
}: {
  meetingSchedule: SettingValue<"meeting_schedule">;
}) {
  const t = await getTranslations();
  const slots = Array.from({ length: MEETING_SLOT_COUNT }, (_, i) => meetingSchedule.slots[i] ?? null);

  return (
    <section id="meeting-schedule" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.meetingSchedule")}</h2>
      <p className="text-xs text-muted-foreground">{t("settings.meetingHint")}</p>
      <form action={saveMeetingSchedule} className="space-y-2">
        {slots.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <EnumSelect
              name={`slot_dow_${i}`}
              defaultValue={String(s?.dow ?? 1)}
              className="w-40"
              options={DOW.map((d) => ({ value: String(d), label: t(`settings.dow.${d}`) }))}
            />
            <TimeField name={`slot_time_${i}`} defaultValue={s?.time ?? ""} className="w-32" />
          </div>
        ))}
        <Button type="submit">{t("actions.save")}</Button>
      </form>
    </section>
  );
}
