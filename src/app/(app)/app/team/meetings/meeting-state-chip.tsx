import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
import { MEETING_STATUS_TOKEN } from "@/lib/statuses";

type Objective = { is_done: boolean; is_deferred: boolean };

/** Every objective checked or deferred (and at least one exists). */
export function isMeetingReady(objectives: Objective[]): boolean {
  return objectives.length > 0 && objectives.every((o) => o.is_done || o.is_deferred);
}

/** Meeting isn't a StatusKind (no dropdown transitions — meetings move via
 * dedicated actions: mark held / cancel). "ready" is a UI-computed
 * pseudo-state: every objective checked or deferred, not yet held. */
export function meetingState(status: string, ready: boolean): "planned" | "ready" | "held" | "cancelled" {
  if (status === "planned" && ready) return "ready";
  return status as "planned" | "held" | "cancelled";
}

export function MeetingStateChip({ status, ready, size = "md" }: { status: string; ready: boolean; size?: "sm" | "md" }) {
  const t = useTranslations();
  const state = meetingState(status, ready);
  return (
    <Chip token={MEETING_STATUS_TOKEN[state]} size={size} dot>
      {t(`status.meeting_status.${state}`)}
    </Chip>
  );
}
