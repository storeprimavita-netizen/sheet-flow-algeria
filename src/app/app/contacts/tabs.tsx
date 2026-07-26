import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { isCurrentUserAdmin } from "@/lib/rbac";

/** Admin-only Customers/Suppliers switcher — agents only ever have the customer view. */
export async function ContactTabs({ active }: { active: "customers" | "suppliers" }) {
  if (!(await isCurrentUserAdmin())) return null;
  const t = await getTranslations("contacts");

  const tabs = [
    { key: "customers", href: "/app/contacts", label: t("customers") },
    { key: "suppliers", href: "/app/contacts/suppliers", label: t("suppliers") },
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
