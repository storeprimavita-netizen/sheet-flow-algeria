import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";

export default async function TeamPage() {
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <PageHeader title={t("team.title")} subtitle={t("team.subtitle")} />
      <Empty>{t("common.rebuildPending")}</Empty>
    </div>
  );
}
