import { getTranslations } from "next-intl/server";

import { TabsNav } from "@/components/tabs-nav";

/** Admin-only Settings switcher (overview / users / seasons / audit). */
export async function SettingsTabs({
  active,
}: {
  active: "overview" | "users" | "seasons" | "audit";
}) {
  const t = await getTranslations("settings.tabs");

  return (
    <TabsNav
      active={active}
      tabs={[
        { key: "overview", href: "/app/settings", label: t("overview") },
        { key: "users", href: "/app/settings/users", label: t("users") },
        { key: "seasons", href: "/app/settings/seasons", label: t("seasons") },
        { key: "audit", href: "/app/settings/audit", label: t("audit") },
      ]}
    />
  );
}
