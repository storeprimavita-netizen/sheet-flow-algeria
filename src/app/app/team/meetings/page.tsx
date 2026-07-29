import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { Users2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { TeamTabs } from "../team-tabs";
import { createNextMeetingInstances } from "../actions";
import { MeetingStateChip, isMeetingReady } from "./meeting-state-chip";

type MeetingCard = {
  id: string;
  title: string;
  scheduled_at: string;
  status: "planned" | "held" | "cancelled";
  ready: boolean;
  attendeeNames: string[];
};

export default async function MeetingsPage() {
  const t = await getTranslations();
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();

  const [{ data }, { data: profiles }] = await Promise.all([
    supabase
      .from("meetings")
      .select("id, title, scheduled_at, status, attendees")
      .eq("workspace_id", workspaceId)
      .order("scheduled_at", { ascending: false }),
    supabase.from("profiles").select("user_id, display_name").eq("workspace_id", workspaceId),
  ]);
  const meetings = data ?? [];
  const nameById = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name ?? p.user_id]));

  const meetingIds = meetings.map((m) => m.id);
  const { data: objectives } = meetingIds.length
    ? await supabase.from("meeting_objectives").select("meeting_id, is_done, is_deferred").in("meeting_id", meetingIds)
    : { data: [] };
  const objectivesByMeeting = new Map<string, { is_done: boolean; is_deferred: boolean }[]>();
  for (const o of objectives ?? []) {
    const list = objectivesByMeeting.get(o.meeting_id) ?? [];
    list.push({ is_done: o.is_done, is_deferred: o.is_deferred });
    objectivesByMeeting.set(o.meeting_id, list);
  }

  const cards: MeetingCard[] = meetings.map((m) => {
    const objs = objectivesByMeeting.get(m.id) ?? [];
    return {
      id: m.id,
      title: m.title,
      scheduled_at: m.scheduled_at,
      status: m.status,
      ready: isMeetingReady(objs),
      attendeeNames: m.attendees.map((a) => nameById.get(a) ?? a),
    };
  });

  const now = new Date().toISOString();
  const upcoming = cards.filter((m) => m.status === "planned" && m.scheduled_at >= now).reverse();
  const past = cards.filter((m) => !(m.status === "planned" && m.scheduled_at >= now));

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="meetings" />

      <form action={createNextMeetingInstances}>
        <Button type="submit">{t("team.createNextInstances")}</Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("team.upcoming")}</h2>
        {!upcoming.length ? <Empty>{t("team.meetingsNone")}</Empty> : <MeetingList meetings={upcoming} />}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">{t("team.history")}</h2>
          <MeetingList meetings={past} />
        </section>
      )}
    </div>
  );
}

function MeetingList({ meetings }: { meetings: MeetingCard[] }) {
  const t = useTranslations();
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {meetings.map((m) => (
        <Link key={m.id} href={`/app/team/meetings/${m.id}`} className="card-surface space-y-2 rounded-xl p-4 text-sm hover:bg-surface-raised">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-medium">{m.title}</div>
              <div className="text-muted-foreground">{formatDateTime(m.scheduled_at)}</div>
            </div>
            <MeetingStateChip status={m.status} ready={m.ready} size="sm" />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{m.attendeeNames.length ? m.attendeeNames.join(", ") : t("team.attendeesNone")}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
