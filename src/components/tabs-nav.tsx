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
    <nav className="flex gap-1 overflow-x-auto border-b border-border text-sm [scrollbar-width:none]">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={
            tab.key === active
              ? "shrink-0 whitespace-nowrap border-b-2 border-primary px-3 py-2 font-medium text-foreground"
              : "shrink-0 whitespace-nowrap px-3 py-2 text-muted-foreground hover:text-foreground"
          }
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
