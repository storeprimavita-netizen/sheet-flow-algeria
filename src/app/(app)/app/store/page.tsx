import { ExternalLink, FileText, SlidersHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button-link";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

import { CreateStoreForm } from "./_components/create-store-form";
import { getStore } from "./_lib/data";

export default async function StoreHubPage() {
  const t = await getTranslations("store.admin");
  const store = await getStore();

  if (!store) {
    return (
      <div className="space-y-6">
        <div>
          <PageHeader title={t("hub.title")} subtitle={t("hub.purpose")} />
        </div>
        <CreateStoreForm />
      </div>
    );
  }

  const supabase = await createClient();
  const { data: pages, error: pagesError } = await supabase
    .from("store_pages")
    .select("slug, status")
    .eq("store_id", store.id)
    .order("published_at", { ascending: false });
  if (pagesError) throw new Error(`store hub pages: ${pagesError.message}`);
  const published = (pages ?? []).filter((p) => p.status === "published");
  const draft = (pages ?? []).length - published.length;
  const firstLive = store.status === "live" ? published[0] : undefined;
  const reason = store.status !== "live" ? t("hub.viewLiveDraftStore") : t("hub.viewLiveNoPage");

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title={t("hub.title")} subtitle={t("hub.purpose")}>
          {firstLive ? (
            <ButtonLink href={`/s/${store.slug}/${firstLive.slug}`} variant="outline">
              <ExternalLink className="h-4 w-4" />
              {t("hub.viewLive")}
            </ButtonLink>
          ) : (
            <span title={reason}>
              <Button type="button" variant="outline" disabled aria-describedby="view-live-reason">
                <ExternalLink className="h-4 w-4" />
                {t("hub.viewLive")}
              </Button>
              <span id="view-live-reason" className="sr-only">
                {reason}
              </span>
            </span>
          )}
        </PageHeader>
      </div>

      <section className="card-surface space-y-4 rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold">{store.name}</h2>
          <StatusPill kind="store" status={store.status} />
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("hub.publicUrl")}</dt>
            <dd className="num" dir="ltr">
              /s/{store.slug}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("hub.openPages")}</dt>
            <dd>{t("hub.pagesCount", { published: published.length, draft })}</dd>
          </div>
        </dl>
        {store.status !== "live" ? <p className="text-sm text-muted-foreground">{t("hub.viewLiveDraftStore")}</p> : null}
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/app/store/pages">
            <FileText className="h-4 w-4" />
            {t("hub.openPages")}
          </ButtonLink>
          <ButtonLink href="/app/store/settings" variant="outline">
            <SlidersHorizontal className="h-4 w-4" />
            {t("hub.openSettings")}
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
