import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TeamTabs } from "../team-tabs";
import { createNextMeetingInstances } from "../actions";

const STATUS_VARIANT = { planned: "secondary", held: "default", cancelled: "outline" } as const;

export default async function MeetingsPage() {
  const t = await getTranslations();
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("meetings")
    .select("id, title, scheduled_at, status")
    .eq("workspace_id", workspaceId)
    .order("scheduled_at", { ascending: false });
  const meetings = data ?? [];

  const now = new Date().toISOString();
  const upcoming = meetings.filter((m) => m.status === "planned" && m.scheduled_at >= now).reverse();
  const past = meetings.filter((m) => !(m.status === "planned" && m.scheduled_at >= now));

  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <TeamTabs active="meetings" />

      <form action={createNextMeetingInstances}>
        <Button type="submit">{t("team.createNextInstances")}</Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("team.upcoming")}</h2>
        {!upcoming.length ? (
          <Empty>{t("team.meetingsNone")}</Empty>
        ) : (
          <MeetingList meetings={upcoming} />
        )}
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

async function MeetingList({
  meetings,
}: {
  meetings: { id: string; title: string; scheduled_at: string; status: keyof typeof STATUS_VARIANT }[];
}) {
  const t = await getTranslations();
  return (
    <div className="card-surface divide-y divide-border rounded-xl">
      {meetings.map((m) => (
        <Link
          key={m.id}
          href={`/app/team/meetings/${m.id}`}
          className="flex items-center justify-between gap-3 p-4 text-sm hover:bg-muted/30"
        >
          <div>
            <div className="font-medium">{m.title}</div>
            <div className="text-muted-foreground">{formatDateTime(m.scheduled_at)}</div>
          </div>
          <Badge variant={STATUS_VARIANT[m.status]}>{t(`status.meeting_status.${m.status}`)}</Badge>
        </Link>
      ))}
    </div>
  );
}
