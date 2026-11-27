import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { TabsNav } from "@/components/tabs-nav";
import { CollectionsTab } from "./_components/collections-tab";
import { IncomeTab } from "./_components/income-tab";

/** Money → Courier cash: cash ledger (collections) and per-product income, one tab each, not blended. */
export default async function CourierCashPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { tab, from, to } = sp;
  const active = tab === "income" ? "income" : "collections";
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.courierCash")} subtitle={t("navPurpose.courierCash")} />
      <TabsNav
        active={active}
        tabs={[
          { key: "collections", href: "/app/money/courier-cash", label: t("cash.tabCollections") },
          { key: "income", href: "/app/money/courier-cash?tab=income", label: t("nav.income") },
        ]}
      />
      {active === "income" ? <IncomeTab from={from} to={to} /> : <CollectionsTab searchParams={sp} />}
    </div>
  );
}
