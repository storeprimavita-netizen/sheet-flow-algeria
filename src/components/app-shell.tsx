"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  Wallet,
  Settings as SettingsIcon,
  LogOut,
  Menu,
} from "lucide-react";

import type { Role } from "@/lib/roles";
import { ROLE_LABEL } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/app/app/dashboard/sign-out-button";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard", icon: LayoutDashboard },
  { label: "Products", icon: Package },
  { label: "Orders", icon: ShoppingBag },
  { label: "Contacts", icon: Users },
  { label: "Expenses", icon: Wallet },
  { label: "Settings", icon: SettingsIcon, adminOnly: true },
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
  const [open, setOpen] = useState(false);
  const items = NAV.filter((i) => !i.adminOnly || role === "admin");
  const initial = (user.email?.[0] ?? "M").toUpperCase();

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-info/30 text-xl">
            🛍️
          </div>
          <div>
            <div className="text-sm font-bold text-gradient">MNW ERP</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Cash on Delivery
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              !!item.href &&
              (pathname === item.href || pathname.startsWith(item.href + "/"));

            if (item.href) {
              return (
                <Link
                  key={item.label}
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
                  {item.label}
                </Link>
              );
            }

            return (
              <span
                key={item.label}
                className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/40"
              >
                <Icon className="h-4 w-4" />
                {item.label}
                <Badge variant="outline" className="ml-auto">
                  soon
                </Badge>
              </span>
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
                    {ROLE_LABEL[role]}
                  </Badge>
                ) : (
                  <Badge variant="outline">no role</Badge>
                )}
              </div>
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex flex-1 flex-col md:pl-64">
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
