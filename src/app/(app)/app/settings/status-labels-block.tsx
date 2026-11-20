import { Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { STATUS_KINDS, type StatusKind } from "@/lib/statuses";
import en from "@/messages/en.json";
import ar from "@/messages/ar.json";
import { StatusLabelsSection, type StatusLabelGroup } from "./status-labels-section";
import { StatusLabelsError } from "./status-labels-error";

/** Default text of a message key ("status.confirmation_status.pending") in one language. */
function defaultText(messages: unknown, path: string): string {
  let cur: unknown = messages;
  for (const part of path.split(".")) {
    if (typeof cur !== "object" || cur === null || !Object.hasOwn(cur, part)) return "";
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : "";
}

function Skeleton() {
  const bar = "animate-pulse rounded-md bg-border";
  return (
    <div className="card-surface space-y-3 rounded-xl p-5" aria-busy="true">
      <div className={`${bar} h-5 w-48`} />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className={`${bar} h-12`} />
      ))}
    </div>
  );
}

export function StatusLabelsBlock({ workspaceId }: { workspaceId: string }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <Loaded workspaceId={workspaceId} />
    </Suspense>
  );
}

async function Loaded({ workspaceId }: { workspaceId: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("status_label_overrides")
    .select("kind, status_key, label_en, label_ar")
    .eq("workspace_id", workspaceId);
  if (error) {
    const t = await getTranslations();
    return <StatusLabelsError title={t("settings.statusLabels.title")} reason={error.message} />;
  }
  const stored = new Map((data ?? []).map((r) => [`${r.kind}/${r.status_key}`, r]));
  const groups: StatusLabelGroup[] = (Object.keys(STATUS_KINDS) as StatusKind[]).map((kind) => ({
    kind,
    statuses: Object.values(STATUS_KINDS[kind]).map((d) => {
      const row = stored.get(`${kind}/${d.key}`);
      return {
        key: d.key,
        defaultEn: defaultText(en, d.label),
        defaultAr: defaultText(ar, d.label),
        en: row?.label_en ?? "",
        ar: row?.label_ar ?? "",
      };
    }),
  }));
  return <StatusLabelsSection groups={groups} />;
}
