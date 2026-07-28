"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";

import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SignOutButton } from "@/app/app/dashboard/sign-out-button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { CommandPalette } from "@/components/command-palette";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { visibleNav, type NavLeaf, type CounterKey } from "@/components/nav-model";

const COLLAPSE_KEY = "mnw:sidebar-collapsed";

export function AppShell({
  user,
  role,
  counts = { confirmation: 0, delivery: 0, tasks: 0 },
  children,
}: {
  user: { email: string };
  role: Role | null;
  counts?: Record<CounterKey, number>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useTranslations();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  }

  const sections = visibleNav(role);
  const initial = (user.email?.[0] ?? "M").toUpperCase();

  // Longest-prefix match: exactly one leaf is active.
  const allLeaves: NavLeaf[] = sections.flatMap((s) => [s, ...(s.children ?? [])]);
  const activeHref = allLeaves
    .filter((l) => pathname === l.href || pathname.startsWith(l.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  function Counter({ counter }: { counter?: CounterKey }) {
    if (!counter) return null;
    const n = counts[counter] ?? 0;
    return (
      <span
        className={cn(
          "num ms-auto rounded-full px-1.5 py-0.5 text-[11px] font-medium",
          n > 0 ? "bg-primary/15 text-primary" : "text-faint",
        )}
      >
        {n}
      </span>
    );
  }

  function Leaf({ item, child }: { item: NavLeaf; child?: boolean }) {
    const Icon = item.icon;
    const active = activeHref === item.href;
    const label = t(`nav.${item.key}`);
    return (
      <Link
        href={item.href}
        onClick={() => setOpen(false)}
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-md py-2 text-sm transition-colors",
          collapsed ? "justify-center px-2" : child ? "ps-9 pe-3" : "px-3",
          active
            ? "bg-primary/10 font-medium text-foreground"
            : "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
        )}
      >
        {active && !collapsed ? (
          <span className="absolute start-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-e bg-primary" aria-hidden />
        ) : null}
        <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
        {!collapsed && <span className="truncate">{label}</span>}
        {!collapsed && <Counter counter={item.counter} />}
      </Link>
    );
  }

  const nav = (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3">
      {sections.map((section) => {
        if (!section.children || collapsed) return <Leaf key={section.href} item={section} />;
        const sectionActive =
          activeHref === section.href || section.children.some((c) => c.href === activeHref);
        return (
          <div key={section.key} className="space-y-0.5 pb-1">
            <Link
              href={section.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-faint hover:text-muted-foreground"
            >
              <section.icon className="h-4 w-4" />
              {t(`nav.${section.key}`)}
            </Link>
            {sectionActive && section.children.map((c) => <Leaf key={c.href} item={c} child />)}
          </div>
        );
      })}
    </nav>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen w-full">
        <aside
          className={cn(
            "fixed inset-y-0 start-0 z-40 flex flex-col border-e border-border bg-surface transition-[transform,width] md:translate-x-0",
            collapsed ? "w-16" : "w-64",
            open ? "max-md:translate-x-0" : "max-md:-translate-x-full max-md:rtl:translate-x-full",
          )}
        >
          <div className="flex h-14 items-center border-b border-border px-3">
            <Button
              variant="ghost"
              size="icon"
              className="ms-auto hidden h-8 w-8 md:inline-flex"
              onClick={toggleCollapsed}
              aria-label="Toggle sidebar"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          {nav}

          <div className={cn("border-t border-border p-3", collapsed && "px-2")}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title={collapsed ? user.email : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md py-1 text-start transition-colors hover:bg-surface-raised",
                    collapsed ? "justify-center px-1" : "px-1",
                  )}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {initial}
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{user.email}</div>
                      <div className="mt-0.5">
                        {role ? (
                          <Badge variant={role === "admin" ? "default" : "secondary"}>{t(`role.${role}`)}</Badge>
                        ) : (
                          <Badge variant="outline">{t("common.noRole")}</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <ThemeToggle className="w-full justify-start" />
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <LocaleSwitcher className="w-full justify-start" />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive asChild>
                  <SignOutButton className="w-full justify-start border-0 bg-transparent shadow-none hover:bg-transparent" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-30 bg-overlay md:hidden" onClick={() => setOpen(false)} />
        )}

        <div className={cn("flex flex-1 flex-col", collapsed ? "md:ps-16" : "md:ps-64")}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
            <CommandPalette role={role}>
              <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" aria-label={t("cmd.title")}>
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">{t("cmd.title")}</span>
                <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">⌘K</kbd>
              </Button>
            </CommandPalette>
            <div className="ms-auto flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-lg">
                🛍️
              </div>
              <div className="hidden min-w-0 sm:block">
                <div className="text-sm font-semibold leading-tight text-foreground">MNW ERP</div>
                <div className="text-[10px] uppercase leading-tight tracking-wider text-muted-foreground">
                  {t("tagline")}
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
