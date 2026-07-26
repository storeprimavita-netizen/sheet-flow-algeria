import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { isCurrentUserAdmin } from "@/lib/rbac";

/** Admin-only queue switcher (agents only ever have one queue to see). */
export async function OrderTabs({ active }: { active: "all" | "confirmation" | "delivery" | "cash" }) {
  if (!(await isCurrentUserAdmin())) return null;
  const t = await getTranslations("orders.tabs");

  const tabs = [
    { key: "all", href: "/app/orders/all", label: t("all") },
    { key: "confirmation", href: "/app/orders/confirmation", label: t("confirmation") },
    { key: "delivery", href: "/app/orders/delivery", label: t("delivery") },
    { key: "cash", href: "/app/orders/cash", label: t("cash") },
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
