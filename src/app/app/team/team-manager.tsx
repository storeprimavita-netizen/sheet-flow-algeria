"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/field";
import { Badge } from "@/components/ui/badge";

export type TeamMember = {
  user_id: string;
  email: string | null;
  role: string | null;
  duty: string | null;
  slack_user_id: string | null;
  slack_channel_id: string | null;
  meeting_late_minutes: number | null;
  is_team_member: boolean;
};

export function TeamManager({ members }: { members: TeamMember[] }) {
  const router = useRouter();
  const t = useTranslations();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function save(e: React.FormEvent<HTMLFormElement>, userId: string) {
    e.preventDefault();
    setBusyId(userId);
    const fd = new FormData(e.currentTarget);
    const opt = (n: string) => String(fd.get(n) ?? "").trim() || null;
    const late = Number(fd.get("meeting_late_minutes") ?? 0);

    const supabase = createClient();
    const { error } = await supabase.from("team_roles").upsert(
      {
        user_id: userId,
        duty: opt("duty"),
        slack_user_id: opt("slack_user_id"),
        slack_channel_id: opt("slack_channel_id"),
        meeting_late_minutes: Number.isFinite(late) && late >= 0 ? late : 0,
        is_active: fd.get("is_active") === "on",
      },
      { onConflict: "user_id" },
    );
    setBusyId(null);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  async function remove(userId: string) {
    if (!window.confirm(t("common.deleteConfirm"))) return;
    setBusyId(userId);
    const supabase = createClient();
    const { error } = await supabase.from("team_roles").delete().eq("user_id", userId);
    setBusyId(null);
    if (error) {
      window.alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {members.map((m) => {
        const id = m.user_id;
        const busy = busyId === id;
        return (
          <form key={id} onSubmit={(e) => save(e, id)} className="glass-card space-y-3 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.email ?? id.slice(0, 8)}</span>
                {m.role ? <Badge variant="secondary">{t(`role.${m.role}`)}</Badge> : null}
                {m.is_team_member ? <Badge>{t("team.member")}</Badge> : null}
              </div>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" name="is_active" defaultChecked={m.is_team_member} />
                {t("team.active")}
              </label>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={t("team.duty")} htmlFor={`duty_${id}`}>
                <Input id={`duty_${id}`} name="duty" defaultValue={m.duty ?? ""} />
              </Field>
              <Field label={t("settings.slackChannel")} htmlFor={`sc_${id}`}>
                <Input id={`sc_${id}`} name="slack_channel_id" defaultValue={m.slack_channel_id ?? ""} />
              </Field>
              <Field label={t("team.slackUser")} htmlFor={`su_${id}`}>
                <Input id={`su_${id}`} name="slack_user_id" defaultValue={m.slack_user_id ?? ""} />
              </Field>
              <Field label={t("team.late")} htmlFor={`ml_${id}`}>
                <Input
                  id={`ml_${id}`}
                  name="meeting_late_minutes"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={m.meeting_late_minutes ?? 0}
                />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? t("actions.saving") : t("actions.save")}
              </Button>
              {m.is_team_member ? (
                <Button type="button" variant="outline" size="sm" onClick={() => remove(id)} disabled={busy}>
                  <Trash2 />
                  {t("actions.delete")}
                </Button>
              ) : null}
            </div>
          </form>
        );
      })}
    </div>
  );
}
