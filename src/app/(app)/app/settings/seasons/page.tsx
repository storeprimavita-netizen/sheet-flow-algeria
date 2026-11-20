import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdminProfile } from "@/lib/rbac";
import { seasonLabel } from "@/lib/seasons";
import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";
import { ButtonLink } from "@/components/button-link";
import { SettingsTabs } from "../settings-tabs";
import { SeasonsEditor } from "./seasons-editor";

export default async function SeasonsPage() {
  const t = await getTranslations();
  await requireAdminProfile();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("seasons")
    .select("id, name, name_key, sort, season_periods(id, year, date_from, date_to)")
    .order("sort");

  const seasons = (data ?? []).map((s) => ({
    id: s.id,
    label: seasonLabel(t, s),
    name: s.name,
    periods: [...s.season_periods].sort((a, b) => b.year - a.year),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.tabs.seasons")} subtitle={t("settings.seasons.purpose")} />
      <SettingsTabs active="seasons" />
      {error ? (
        <Empty>
          <div role="alert">
            <p className="font-medium text-foreground">{t("settings.seasons.loadError")}</p>
            <div className="mt-4 flex justify-center">
              <ButtonLink href="/app/settings/seasons" size="sm">{t("statistics.retry")}</ButtonLink>
            </div>
          </div>
        </Empty>
      ) : (
        <SeasonsEditor seasons={seasons} />
      )}
    </div>
  );
}
