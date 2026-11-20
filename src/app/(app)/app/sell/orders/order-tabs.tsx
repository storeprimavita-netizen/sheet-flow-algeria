import { getTranslations } from "next-intl/server";

import { TabsNav } from "@/components/tabs-nav";

/** Admin-only queue switcher (agents only ever have one queue to see). */
export async function OrderTabs({ active }: { active: "all" | "confirmation" | "delivery" | "cash" }) {
  const t = await getTranslations("orders.tabs");

  return (
    <TabsNav
      active={active}
      tabs={[
        { key: "all", href: "/app/sell/orders", label: t("all") },
        { key: "confirmation", href: "/app/sell/confirmation", label: t("confirmation") },
        { key: "delivery", href: "/app/sell/shipping", label: t("delivery") },
        { key: "cash", href: "/app/money/courier-cash", label: t("cash") },
      ]}
    />
  );
}
