import { getTranslations } from "next-intl/server";

import type { MyDayData } from "@/lib/my-day";
import { formatDate, formatDateTime, formatInt } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { StatusPill } from "@/components/status-pill";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-surface rounded-xl p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="num mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatInt(value)}</div>
    </div>
  );
}

/** Read-only: tasks and the meeting are plain rows (agents cannot open those pages). No money anywhere. */
export async function MyDayView({ data }: { data: MyDayData }) {
  const t = await getTranslations("myDay");
  const queueHref = data.kind === "confirmation" ? "/app/sell/confirmation" : "/app/sell/shipping";
  const stats =
    data.kind === "confirmation"
      ? [
          { key: "confirmed", value: data.numbers.confirmed },
          { key: "cancelled", value: data.numbers.cancelled },
          { key: "callAgain", value: data.numbers.callAgain },
          { key: "handled", value: data.numbers.handled },
        ]
      : [
          { key: "delivered", value: data.numbers.delivered },
          { key: "returned", value: data.numbers.returned },
        ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <section aria-labelledby="my-day-queue" className="card-surface flex flex-wrap items-center justify-between gap-4 rounded-xl p-4">
        <div>
          <h2 id="my-day-queue" className="text-sm font-medium text-muted-foreground">
            {t(data.kind === "confirmation" ? "queueConfirmation" : "queueDelivery")}
          </h2>
          <div className="num mt-1 text-3xl font-semibold tabular-nums text-foreground">{formatInt(data.queue)}</div>
        </div>
        <ButtonLink href={queueHref}>{t("openQueue")}</ButtonLink>
      </section>

      <section aria-labelledby="my-day-numbers" className="space-y-3">
        <div>
          <h2 id="my-day-numbers" className="text-sm font-medium text-muted-foreground">{t("numbers")}</h2>
          <p className="text-xs text-muted-foreground">{t("numbersHelp")}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => <Stat key={s.key} label={t(`stat.${s.key}`)} value={s.value} />)}
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section aria-labelledby="my-day-tasks" className="card-surface space-y-3 rounded-xl p-4">
          <h2 id="my-day-tasks" className="text-sm font-medium text-muted-foreground">{t("tasks")}</h2>
          {data.tasks.length === 0 ? (
            <Empty className="border-0 p-4 shadow-none">{t("tasksEmpty")}</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {data.tasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-foreground">{task.title}</div>
                    {task.dueDate ? <div className="num text-xs text-muted-foreground">{formatDate(task.dueDate)}</div> : null}
                  </div>
                  <StatusPill kind="task" status={task.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="my-day-meeting" className="card-surface space-y-3 rounded-xl p-4">
          <h2 id="my-day-meeting" className="text-sm font-medium text-muted-foreground">{t("nextMeeting")}</h2>
          {data.nextMeeting ? (
            <div>
              <div className="text-sm font-medium text-foreground">{data.nextMeeting.title}</div>
              <div className="num mt-1 text-xs text-muted-foreground">{formatDateTime(data.nextMeeting.scheduledAt)}</div>
            </div>
          ) : (
            <Empty className="border-0 p-4 shadow-none">{t("meetingEmpty")}</Empty>
          )}
        </section>
      </div>
    </div>
  );
}
