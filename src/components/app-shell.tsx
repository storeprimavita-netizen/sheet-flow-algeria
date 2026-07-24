import Link from "next/link";
import type { ReactNode } from "react";

import type { Role } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/app/app/dashboard/sign-out-button";

type NavItem = { label: string; href?: string; soon?: boolean; adminOnly?: boolean };

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/app/dashboard" },
  { label: "Products", soon: true },
  { label: "Orders", soon: true },
  { label: "Contacts", soon: true },
  { label: "Expenses", soon: true },
  { label: "Settings", soon: true, adminOnly: true },
];

export function AppShell({
  user,
  role,
  children,
}: {
  user: { email: string };
  role: Role | null;
  children: ReactNode;
}) {
  const items = NAV.filter((i) => !i.adminOnly || role === "admin");

  return (
    <div className="flex min-h-screen bg-background text-ink">
      <aside className="flex w-64 shrink-0 flex-col border-e border-line bg-surface">
        <div className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground">
            M
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">MNW ERP</p>
            <p className="text-xs text-muted">Cash on Delivery</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-2 text-sm font-medium text-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.label}
                className="flex cursor-default items-center justify-between rounded-md px-3 py-2 text-sm text-muted"
              >
                {item.label}
                <Badge tone="neutral">soon</Badge>
              </span>
            ),
          )}
        </nav>

        <div className="border-t border-line p-3">
          <div className="px-2 py-2">
            <p className="truncate text-sm font-medium" title={user.email}>
              {user.email}
            </p>
            <div className="mt-1.5">
              {role ? (
                <Badge tone={role === "admin" ? "primary" : "neutral"}>
                  {ROLE_LABEL[role]}
                </Badge>
              ) : (
                <Badge tone="warning">no role</Badge>
              )}
            </div>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <div className="mx-auto max-w-6xl p-8">{children}</div>
      </main>
    </div>
  );
}
