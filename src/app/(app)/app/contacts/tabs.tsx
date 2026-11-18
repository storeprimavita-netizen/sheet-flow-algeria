import { getTranslations } from "next-intl/server";

import { TabsNav } from "@/components/tabs-nav";

/** Admin-only Customers/Suppliers switcher — agents only ever have the customer view. */
export async function ContactTabs({ active }: { active: "customers" | "suppliers" }) {
  const t = await getTranslations("contacts");

  return (
    <TabsNav
      active={active}
      tabs={[
        { key: "customers", href: "/app/contacts", label: t("customers") },
        { key: "suppliers", href: "/app/contacts/suppliers", label: t("suppliers") },
      ]}
    />
  );
}
