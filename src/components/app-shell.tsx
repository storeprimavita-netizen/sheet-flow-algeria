"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  UserCog,
  Settings as SettingsIcon,
  Menu,
} from "lucide-react";

import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/app/app/dashboard/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";

type NavKey = "dashboard" | "orders" | "products" | "contacts" | "team" | "settings";

type NavItem = {
  navKey: NavKey;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

/** Exactly six sections (SPEC §1). Agents only ever see Orders — their queue. */
const NAV: NavItem[] = [
  { navKey: "dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { navKey: "orders", href: "/app/orders", icon: ShoppingBag },
  { navKey: "products", href: "/app/products", icon: Package },
  { navKey: "contacts", href: "/app/contacts", icon: Users },
  { navKey: "team", href: "/app/team", icon: UserCog },
  { navKey: "settings", href: "/app/settings", icon: SettingsIcon },
];

export function AppShell({
  user,
  role,
  children,
}: {
  user: { email: string };
  role: Role | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const items = role === "admin" ? NAV : NAV.filter((i) => i.navKey === "orders");
  const initial = (user.email?.[0] ?? "M").toUpperCase();

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-40 flex w-64 flex-col border-e border-sidebar-border bg-sidebar transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full rtl:translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-info/30 text-xl">
            🛍️
          </div>
          <div>
            <div className="text-sm font-bold text-gradient">MNW ERP</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("tagline")}
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const label = t(`nav.${item.navKey}`);
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.navKey}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info text-sm font-semibold text-primary-foreground">
              {initial}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium" title={user.email}>
                {user.email}
              </div>
              <div className="mt-0.5">
                {role ? (
                  <Badge variant={role === "admin" ? "default" : "secondary"}>
                    {t(`role.${role}`)}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t("common.noRole")}</Badge>
                )}
              </div>
            </div>
          </div>
          <LocaleSwitcher />
          <SignOutButton />
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col md:ps-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/60 px-4 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold text-gradient">
            <span>🛍️</span> MNW ERP
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
