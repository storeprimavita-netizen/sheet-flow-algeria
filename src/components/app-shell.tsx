"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ChevronDown, Menu, PanelLeftClose, PanelLeftOpen, Search, Store } from "lucide-react";

import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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
import { visibleNav, activeLeafHref, groupCounterTotal, parseClosedGroups, type NavLeaf, type NavGroup, type CounterKey } from "@/components/nav-model";

const COLLAPSE_KEY = "mnw:sidebar-collapsed";
const GROUPS_KEY = "mnw:nav-groups";

type NavCtx = {
  t: ReturnType<typeof useTranslations>;
  counts: Record<CounterKey, number>;
  collapsed: boolean;
  tooltipSide: "left" | "right";
  activeHref: string | undefined;
  onNavigate: () => void;
};

function Counter({ counter, n: given, counts }: { counter?: CounterKey; n?: number; counts: Record<CounterKey, number> }) {
  if (!counter && given === undefined) return null;
  const n = given ?? counts[counter!] ?? 0;
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

function Leaf({ ctx, item, activeOverride, label: labelOverride }: { ctx: NavCtx; item: NavLeaf; activeOverride?: boolean; label?: string }) {
  const { t, collapsed, tooltipSide, activeHref, counts } = ctx;
  const Icon = item.icon;
  const active = activeOverride ?? activeHref === item.href;
  const label = labelOverride ?? t(`nav.${item.key}`);
  const link = (
    <Link
      href={item.href}
      onClick={ctx.onNavigate}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md py-2 text-sm transition-colors max-md:min-h-11",
        collapsed ? "justify-center px-2" : "px-3",
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
      {!collapsed && <Counter counter={item.counter} counts={counts} />}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side={tooltipSide}>{label}</TooltipContent>
    </Tooltip>
  );
}

function Group({
  ctx,
  group,
  closedGroups,
  onToggle,
}: {
  ctx: NavCtx;
  group: NavGroup;
  closedGroups: Record<string, boolean>;
  onToggle: (key: string, nextClosed: boolean) => void;
}) {
  const { t, counts, collapsed, activeHref } = ctx;
  const hasActive = group.items.some((i) => i.href === activeHref);
  const isOpen = hasActive || !(closedGroups[group.key] ?? group.defaultClosed ?? false);
  const total = groupCounterTotal(group, counts);
  if (collapsed) {
    return (
      <div className="space-y-0.5 border-t border-border pt-2 first:border-t-0 first:pt-0">
        {group.items.map((i) => <Leaf key={i.href} ctx={ctx} item={i} />)}
      </div>
    );
  }
  const headerClass = "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground max-md:min-h-11";
  return (
    <div>
      {hasActive ? (
        <div className={headerClass}>
          <span className="truncate">{t(`nav.${group.key}`)}</span>
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={!isOpen && total > 0 ? t("nav.groupPending", { group: t(`nav.${group.key}`), n: total }) : undefined}
          onClick={() => onToggle(group.key, isOpen)}
          className={cn(headerClass, "transition-colors hover:text-foreground")}
        >
          <span className="truncate">{t(`nav.${group.key}`)}</span>
          {!isOpen && total > 0 ? <Counter n={total} counts={counts} /> : null}
          <ChevronDown
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-faint transition-transform",
              !(!isOpen && total > 0) && "ms-auto",
              !isOpen && "-rotate-90 rtl:rotate-90",
            )}
          />
        </button>
      )}
      {isOpen ? (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((i) => <Leaf key={i.href} ctx={ctx} item={i} />)}
        </div>
      ) : null}
    </div>
  );
}

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
  const tooltipSide = useLocale() === "ar" ? "left" : "right";
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false);
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({}); // user-collapsed groups

  const [kbdHint, setKbdHint] = useState("⌘K");
  useEffect(() => {
    if (!/Mac|iPhone|iPad/.test(navigator.platform)) setKbdHint("Ctrl K");
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    setClosedGroups(parseClosedGroups(localStorage.getItem(GROUPS_KEY)));
  }, []);

  // Keep the active page visible when the nav itself scrolls (short screens, Settings at the end).
  useEffect(() => {
    document.querySelector("aside nav [aria-current='page']")?.scrollIntoView({ block: "nearest" });
  }, [pathname, collapsed]);

  function toggleGroup(key: string, nextClosed: boolean) {
    setClosedGroups((g) => {
      const next = { ...g, [key]: nextClosed };
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function toggleCollapsed() {
    setCollapsed((c) => {
      localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      return !c;
    });
  }

  const { home, groups } = visibleNav(role);
  const mainGroups = groups.filter((g) => g.pinned !== "bottom");
  const bottomGroups = groups.filter((g) => g.pinned === "bottom");
  const initial = (user.email?.[0] ?? "M").toUpperCase();
  const activeHref = activeLeafHref(role, pathname);

  const ctx: NavCtx = {
    t,
    counts,
    collapsed,
    tooltipSide,
    activeHref,
    onNavigate: () => setOpen(false),
  };

  // D33: fade the list edge while items are hidden beyond it.
  const navRef = useRef<HTMLElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const measure = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setFade((f) => (f.top === top && f.bottom === bottom ? f : { top, bottom }));
  }, []);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure); // size changes of the list, its content (groups opened/closed) and the sidebar
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure, collapsed, closedGroups, role]);

  const nav = (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <nav ref={navRef} onScroll={measure} className="flex-1 overflow-y-auto p-3">
        <div className="space-y-3">
          {home ? <Leaf ctx={ctx} item={home} /> : null}
          {mainGroups.map((g) => (
            <Group key={g.key} ctx={ctx} group={g} closedGroups={closedGroups} onToggle={toggleGroup} />
          ))}
        </div>
      </nav>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-11 bg-linear-to-b from-surface to-transparent transition-opacity",
          fade.top ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-11 bg-linear-to-t from-surface to-transparent transition-opacity",
          fade.bottom ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );

  // D32: Settings is one always-visible row outside the scroll area, above the user block.
  const settingsGroup = bottomGroups[0];
  const settingsRow = settingsGroup ? (
    <div className={cn("border-t border-border p-3 pb-0", collapsed && "px-2")}>
      <Leaf
        ctx={ctx}
        item={settingsGroup.items[0]}
        label={t("nav.groupSettings")}
        activeOverride={settingsGroup.items.some((i) => i.href === activeHref)}
      />
    </div>
  ) : null;

  const brandHref = home?.href ?? groups[0]?.items[0]?.href;
  const brandClass = "flex min-w-0 items-center gap-2.5";
  const brandBody = (
    <>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Store className="h-4 w-4" />
      </span>
      {!collapsed && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight">MNW ERP</span>
          <span className="block truncate text-[10px] uppercase leading-tight tracking-wider text-muted-foreground">
            {t("tagline")}
          </span>
        </span>
      )}
    </>
  );
  const brand = brandHref ? <Link href={brandHref} className={brandClass}>{brandBody}</Link> : <div className={brandClass}>{brandBody}</div>;

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
          <div className={cn("flex h-14 items-center gap-2 border-b border-border px-3", collapsed && "justify-center px-2")}>
            {!collapsed && brand}
            <Button
              variant="ghost"
              size="icon"
              className="ms-auto hidden h-8 w-8 md:inline-flex"
              onClick={toggleCollapsed}
              aria-label={t("nav.toggleSidebar")}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          {nav}
          {settingsRow}

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

        <div className={cn("flex min-w-0 flex-1 flex-col", collapsed ? "md:ps-16" : "md:ps-64")}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)} aria-label={t("nav.toggleSidebar")}>
              <Menu className="h-5 w-5" />
            </Button>
            <CommandPalette role={role}>
              <Button variant="outline" size="sm" className="gap-2 text-muted-foreground" aria-label={t("cmd.title")}>
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">{t("cmd.title")}</span>
                <kbd className="hidden rounded border border-border px-1 text-[10px] sm:inline">{kbdHint}</kbd>
              </Button>
            </CommandPalette>
            <div className="ms-auto md:hidden">{brand}</div>
          </header>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
