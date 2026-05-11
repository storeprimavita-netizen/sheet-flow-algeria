import { createFileRoute, Outlet, Link, useRouterState, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useSheetsData } from "@/lib/sheets-hooks";
import {
  LayoutDashboard,
  CreditCard,
  Landmark,
  Package,
  Search,
  Users,
  Settings as SettingsIcon,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", icon: CreditCard },
  { to: "/accounts", label: "Accounts", icon: Landmark },
  { to: "/products", label: "Products", icon: Package },
  { to: "/spy", label: "Spy & Research", icon: Search },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function AppLayout() {
  const { user, partner, signOut, loading } = useAuth();
  const { data } = useSheetsData();
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  const rate = data?.settings.exchange_rate ?? 250;

  return (
    <div className="flex min-h-screen w-full">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-info/30 text-2xl">💰</div>
          <div>
            <div className="text-sm font-bold text-gradient">WMN Finance</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Partners Hub
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active = path === item.to || (item.to !== "/" && path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-3 border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-info text-sm font-semibold text-primary-foreground">
              {partner[0]}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium">{partner}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-1.5 text-xs">
            <span className="text-muted-foreground">1 USD</span>
            <span className="font-mono font-semibold text-primary">{rate} DZD</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => signOut()}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/60 px-4 backdrop-blur md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold text-gradient"><span>💰</span>WMN Finance</div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
