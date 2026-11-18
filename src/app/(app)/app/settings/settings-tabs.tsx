import { getTranslations } from "next-intl/server";

import { TabsNav } from "@/components/tabs-nav";

/** Admin-only Settings switcher (overview / users / audit). */
export async function SettingsTabs({
  active,
}: {
  active: "overview" | "users" | "audit";
}) {
  const t = await getTranslations("settings.tabs");

  return (
    <TabsNav
      active={active}
      tabs={[
        { key: "overview", href: "/app/settings", label: t("overview") },
        { key: "users", href: "/app/settings/users", label: t("users") },
        { key: "audit", href: "/app/settings/audit", label: t("audit") },
      ]}
    />
  );
}
