import { getTranslations } from "next-intl/server";

import { TabsNav } from "@/components/tabs-nav";

/** Admin-only subsection switcher for Finance (mirrors OrderTabs/ContactTabs/TeamTabs). */
export async function FinanceTabs({ active }: { active: "overview" | "expenses" | "ad-spend" | "income" | "accounts" }) {
  const t = await getTranslations("nav");

  return (
    <TabsNav
      active={active}
      tabs={[
        { key: "overview", href: "/app/money/overview", label: t("financeOverview") },
        { key: "expenses", href: "/app/money/expenses", label: t("expenses") },
        { key: "ad-spend", href: "/app/money/ad-spend", label: t("adSpend") },
        { key: "income", href: "/app/money/courier-cash?tab=income", label: t("income") },
        { key: "accounts", href: "/app/money/accounts", label: t("accounts") },
      ]}
    />
  );
}
