import { getTranslations } from "next-intl/server";

import { TabsNav } from "@/components/tabs-nav";

/** Admin-only Team switcher (rules, meetings, tasks, performance).
 * Agents never see this — they only ever reach /app/team/rules, directly. */
export async function TeamTabs({
  active,
}: {
  active: "rules" | "meetings" | "tasks" | "performance";
}) {
  const t = await getTranslations("team.tabs");

  return (
    <TabsNav
      active={active}
      tabs={[
        { key: "rules", href: "/app/team/rules", label: t("rules") },
        { key: "meetings", href: "/app/team/meetings", label: t("meetings") },
        { key: "tasks", href: "/app/team/tasks", label: t("tasks") },
        { key: "performance", href: "/app/team/performance", label: t("performance") },
      ]}
    />
  );
}
