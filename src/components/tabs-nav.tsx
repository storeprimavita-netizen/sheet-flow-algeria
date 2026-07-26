import Link from "next/link";

import { isCurrentUserAdmin } from "@/lib/rbac";

/**
 * Admin-only section tab switcher — shared shape behind OrderTabs, ContactTabs,
 * TeamTabs (agents never see these; each section has at most one queue/view
 * for them, nothing to switch between).
 */
export async function TabsNav<K extends string>({
  active,
  tabs,
}: {
  active: K;
  tabs: readonly { key: K; href: string; label: string }[];
}) {
  if (!(await isCurrentUserAdmin())) return null;

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
