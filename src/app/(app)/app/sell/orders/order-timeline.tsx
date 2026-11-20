"use client";

import { useTranslations } from "next-intl";

import { StatusPill } from "@/components/status-pill";
import { formatDateTime } from "@/lib/format";

export type TimelineEvent = {
  id: string | number;
  stage: string;
  to_status: string;
  actor: string | null;
  created_at: string | null;
  comment: string | null;
};

/** "3d" / "2h 15m" / "just now" — coarse gap between two ISO timestamps. */
function humanGap(fromISO: string | null, toISO: string | null): string {
  if (!fromISO || !toISO) return "";
  const ms = new Date(toISO).getTime() - new Date(fromISO).getTime();
  if (ms < 60_000) return "< 1m";
  const mins = Math.floor(ms / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return `${hours}h ${mins % 60}m`;
  return `${mins}m`;
}

/**
 * Status timeline: one row per transition with actor + how long the order sat
 * in that status. Shared by the Orders → All detail sheet and the order page.
 * `events` may arrive in any order; sorted ascending here for gap maths.
 */
export function OrderTimeline({
  events,
  actorNames,
}: {
  events: TimelineEvent[];
  actorNames: Record<string, string>;
}) {
  const t = useTranslations();
  if (!events.length) return <p className="text-sm text-muted-foreground">{t("orders.eventsNone")}</p>;

  const asc = [...events].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
  );

  return (
    <ol className="space-y-3">
      {asc.map((ev, i) => {
        const nextAt = i < asc.length - 1 ? asc[i + 1].created_at : new Date().toISOString();
        const kind = ev.stage === "confirmation" ? "confirmation" : "delivery";
        const gap = humanGap(ev.created_at, nextAt);
        return (
          <li key={ev.id} className="flex flex-col gap-1 border-s-2 border-border ps-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill kind={kind} status={ev.to_status} size="sm" />
              {gap ? <span className="num text-xs text-muted-foreground">{gap}</span> : null}
            </div>
            <span className="text-xs text-muted-foreground">
              {ev.actor ? actorNames[ev.actor] ?? ev.actor.slice(0, 8) : t("orders.systemActor")} ·{" "}
              {formatDateTime(ev.created_at)}
            </span>
            {ev.comment ? <p className="text-muted-foreground">{ev.comment}</p> : null}
          </li>
        );
      })}
    </ol>
  );
}
