import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";

export default async function CashPage() {
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <PageHeader title={t("cash.title")} subtitle={t("cash.subtitle")} />
      <Empty>{t("common.rebuildPending")}</Empty>
    </div>
  );
}
