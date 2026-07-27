import { getTranslations } from "next-intl/server";

import type { Tables } from "@/lib/supabase/database.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/empty";
import { replayWebhookEvent } from "./actions";

export async function WebhookEventsSection({ events }: { events: Tables<"webhook_events">[] }) {
  const t = await getTranslations();

  return (
    <section className="card-surface space-y-4 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.recentEvents")}</h2>
      {events.length === 0 ? (
        <Empty>{t("settings.noEvents")}</Empty>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{t(`status.order_source.${e.provider}`)}</span>
                <span className="text-xs text-muted-foreground">{e.external_id ?? "—"}</span>
                <Badge variant={e.signature_ok ? "default" : "destructive"}>
                  {e.signature_ok ? t("settings.signatureOk") : t("settings.signatureBad")}
                </Badge>
                <Badge variant={e.processed_at ? "default" : "outline"}>
                  {e.processed_at ? t("settings.processed") : t("settings.pendingEvent")}
                </Badge>
                <span className="ms-auto text-xs text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </div>
              {e.error ? <p className="mt-1 text-xs text-destructive">{e.error}</p> : null}
              <div className="mt-2 flex items-center gap-3">
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    {t("settings.viewPayload")}
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-input bg-muted/30 p-2 text-xs">
                    {JSON.stringify(e.payload, null, 2)}
                  </pre>
                </details>
                <form action={replayWebhookEvent.bind(null, e.id)}>
                  <Button type="submit" variant="outline" size="sm">
                    {t("settings.replay")}
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
