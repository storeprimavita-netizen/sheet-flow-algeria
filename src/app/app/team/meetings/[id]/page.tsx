import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Trash2, Undo2 } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminProfile } from "@/lib/rbac";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MultiSelectSearch } from "@/components/multi-select-search";
import {
  addObjective,
  toggleObjective,
  deferObjective,
  deleteObjective,
  saveMeetingNotes,
  setAttendees,
  cancelMeeting,
} from "../../actions";
import { MarkHeldButton } from "../mark-held-button";
import { MeetingStateChip, isMeetingReady } from "../meeting-state-chip";
import { CopyAgendaButton } from "../copy-agenda-button";

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations();
  const { workspaceId } = await requireAdminProfile();
  const supabase = await createClient();

  const { data: meeting } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!meeting) notFound();

  const [{ data: objectives }, { data: profiles }] = await Promise.all([
    supabase.from("meeting_objectives").select("*").eq("meeting_id", id).order("position"),
    supabase.from("profiles").select("user_id, display_name").eq("workspace_id", workspaceId),
  ]);

  const admin = await createAdminClient();
  const { data: usersPage } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(usersPage?.users.map((u) => [u.id, u.email ?? ""]) ?? []);
  const attendeeOptions = (profiles ?? []).map((p) => ({
    value: p.user_id,
    label: p.display_name ?? emailById.get(p.user_id) ?? p.user_id,
  }));
  const attendeeNames = meeting.attendees.map((a) => attendeeOptions.find((o) => o.value === a)?.label ?? a);

  const objs = objectives ?? [];
  const ready = isMeetingReady(objs);

  return (
    <div className="space-y-6">
      <PageHeader title={meeting.title} subtitle={formatDateTime(meeting.scheduled_at)} />

      <div className="flex flex-wrap items-center gap-3">
        <MeetingStateChip status={meeting.status} ready={ready} />
        {meeting.status === "planned" && (
          <>
            <MarkHeldButton meetingId={meeting.id} />
            <form action={cancelMeeting.bind(null, meeting.id)}>
              <Button type="submit" variant="outline" size="sm">
                {t("actions.cancel")}
              </Button>
            </form>
          </>
        )}
        <CopyAgendaButton title={meeting.title} scheduledAt={meeting.scheduled_at} attendeeNames={attendeeNames} objectives={objs} />
      </div>

      <section className="card-surface space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("team.objectives")}</h2>
        {!objs.length ? (
          <p className="text-sm text-muted-foreground">{t("team.objectivesNone")}</p>
        ) : (
          <ul className="space-y-1.5">
            {objs.map((o) => (
              <li key={o.id} className="flex items-center gap-2 text-sm">
                <form action={toggleObjective.bind(null, meeting.id, o.id, !o.is_done)} className="min-w-0">
                  <button type="submit" className="flex min-w-0 items-center gap-2 hover:underline">
                    <input type="checkbox" checked={o.is_done} readOnly className="h-4 w-4 shrink-0" />
                    <span className={`truncate ${o.is_done ? "text-muted-foreground line-through" : o.is_deferred ? "text-muted-foreground" : ""}`}>
                      {o.content}
                    </span>
                  </button>
                </form>
                {o.carried_from ? (
                  <Chip token="info" size="sm">
                    {t("team.carriedOver")}
                  </Chip>
                ) : null}
                <form action={deferObjective.bind(null, meeting.id, o.id, !o.is_deferred)}>
                  <Button type="submit" variant="ghost" size="sm" title={t(o.is_deferred ? "team.undefer" : "team.defer")}>
                    <Undo2 className={`h-3.5 w-3.5 ${o.is_deferred ? "text-info" : ""}`} />
                  </Button>
                </form>
                <form action={deleteObjective.bind(null, meeting.id, o.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addObjective.bind(null, meeting.id)} className="flex gap-2">
          <Input name="content" placeholder={t("team.addObjective")} required />
          <Button type="submit">{t("actions.create")}</Button>
        </form>
      </section>

      <section className="card-surface space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("team.attendees")}</h2>
        <form action={setAttendees.bind(null, meeting.id)} className="flex items-start gap-2">
          <MultiSelectSearch name="attendees" options={attendeeOptions} defaultValues={meeting.attendees} />
          <Button type="submit">{t("actions.save")}</Button>
        </form>
      </section>

      <section className="card-surface space-y-3 rounded-xl p-5">
        <h2 className="text-sm font-semibold">{t("team.notes")}</h2>
        <form action={saveMeetingNotes.bind(null, meeting.id)} className="space-y-3">
          <Textarea name="notes" defaultValue={meeting.notes ?? ""} rows={6} />
          <Button type="submit">{t("actions.save")}</Button>
        </form>
      </section>
    </div>
  );
}
