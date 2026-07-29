import { getTranslations } from "next-intl/server";

import { TabsNav } from "@/components/tabs-nav";

/** Admin-only Team & Rules switcher (mirrors ContactTabs/OrderTabs). Agents
 * never see this — they only ever reach /app/team/rules, directly. */
export async function TeamTabs({
  active,
}: {
  active: "users" | "rules" | "meetings" | "tasks" | "performance" | "audit";
}) {
  const t = await getTranslations("team.tabs");

  return (
    <TabsNav
      active={active}
      tabs={[
        { key: "users", href: "/app/team", label: t("users") },
        { key: "rules", href: "/app/team/rules", label: t("rules") },
        { key: "meetings", href: "/app/team/meetings", label: t("meetings") },
        { key: "tasks", href: "/app/team/tasks", label: t("tasks") },
        { key: "performance", href: "/app/team/performance", label: t("performance") },
        { key: "audit", href: "/app/team/audit", label: t("audit") },
      ]}
    />
  );
}
