"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { markMeetingHeld } from "../actions";

/** Client wrapper so `guard_meeting_held`'s trigger error (00005_team.sql —
 * "fill the objectives checklist before marking a meeting as held") surfaces
 * inline instead of an uncaught server-action throw (Next 16 error-handling
 * guidance: model expected errors as return values, not exceptions). */
export function MarkHeldButton({ meetingId, disabled }: { meetingId: string; disabled?: boolean }) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const res = await markMeetingHeld(meetingId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Button type="button" onClick={onClick} disabled={disabled || busy}>
        {busy ? t("actions.saving") : t("team.markHeld")}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
