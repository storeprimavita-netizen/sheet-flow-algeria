"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

type Objective = { content: string; is_done: boolean; is_deferred: boolean; carried_from: string | null };

/** Plain-text agenda, suitable for pasting into WhatsApp (section-checklists.md
 * §Team & Rules) — no markdown, just a readable checklist. */
export function CopyAgendaButton({
  title,
  scheduledAt,
  attendeeNames,
  objectives,
}: {
  title: string;
  scheduledAt: string;
  attendeeNames: string[];
  objectives: Objective[];
}) {
  const t = useTranslations();

  function onClick() {
    const lines = [
      title,
      formatDateTime(scheduledAt),
      "",
      `${t("team.attendees")}: ${attendeeNames.length ? attendeeNames.join(", ") : "—"}`,
      "",
      `${t("team.objectives")}:`,
      ...(objectives.length
        ? objectives.map((o) => {
            const box = o.is_done ? "x" : o.is_deferred ? "~" : " ";
            const tag = o.carried_from ? ` (${t("team.carriedOver")})` : "";
            return `- [${box}] ${o.content}${tag}`;
          })
        : [`(${t("team.objectivesNone")})`]),
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success(t("team.agendaCopied"));
  }

  return (
    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onClick}>
      <Copy className="h-4 w-4" />
      {t("team.copyAgenda")}
    </Button>
  );
}
