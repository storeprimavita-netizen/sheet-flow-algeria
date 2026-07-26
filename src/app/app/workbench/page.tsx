import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";

export default async function WorkbenchPage() {
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <PageHeader title={t("workbench.title")} subtitle={t("workbench.subtitle")} />
      <Empty>{t("common.rebuildPending")}</Empty>
    </div>
  );
}
