import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { Empty } from "@/components/empty";

export default async function StockPage() {
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <PageHeader title={t("stock.title")} subtitle={t("stock.subtitle")} />
      <Empty>{t("common.rebuildPending")}</Empty>
    </div>
  );
}
