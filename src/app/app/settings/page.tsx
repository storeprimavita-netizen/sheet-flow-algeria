import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";

export default async function SettingsPage() {
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <Empty>{t("common.rebuildPending")}</Empty>
    </div>
  );
}
