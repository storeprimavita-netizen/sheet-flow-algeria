import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { isCurrentUserAdmin } from "@/lib/rbac";

/** Admin-only Team & Rules switcher (mirrors ContactTabs/OrderTabs). Agents
 * never see this — they only ever reach /app/team/rules, directly. */
export async function TeamTabs({
  active,
}: {
  active: "users" | "rules" | "meetings" | "performance" | "audit";
}) {
  if (!(await isCurrentUserAdmin())) return null;
  const t = await getTranslations("team.tabs");

  const tabs = [
    { key: "users", href: "/app/team", label: t("users") },
    { key: "rules", href: "/app/team/rules", label: t("rules") },
    { key: "meetings", href: "/app/team/meetings", label: t("meetings") },
    { key: "performance", href: "/app/team/performance", label: t("performance") },
    { key: "audit", href: "/app/team/audit", label: t("audit") },
  ] as const;

  return (
    <nav className="flex gap-1 border-b border-border text-sm">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === active
              ? "border-b-2 border-primary px-3 py-2 font-medium text-foreground"
              : "px-3 py-2 text-muted-foreground hover:text-foreground"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
