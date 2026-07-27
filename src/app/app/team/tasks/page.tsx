import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";

// Tasks kanban is built in phase 12/13; nav shell only for now.
export default async function TasksPage() {
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.tasks")} subtitle={t("team.subtitle")} />
      <Empty>{t("common.rebuildPending")}</Empty>
    </div>
  );
}
