"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PlusCircle, Package, Building2, Megaphone, Users, Hash } from "lucide-react";

import type { Role } from "@/lib/roles";
import { paletteFilter, hasPaletteMatch } from "@/lib/palette-filter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { visibleNav, type NavLeaf } from "@/components/nav-model";

/**
 * ⌘K palette: navigate anywhere (role-filtered), run quick actions, and search
 * customers by name/phone (routes to the filtered list). `?` opens the shortcut
 * overlay. Order/product entity search hooks in phase 12.
 * ponytail: search routes to existing ?q pages instead of fetching into the palette.
 */
export function CommandPalette({ role, children }: { role: Role | null; children: React.ReactNode }) {
  const router = useRouter();
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [help, setHelp] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const returnFocus = React.useRef<HTMLElement | null>(null);

  // No Radix Trigger here (opened by state / ⌘K), so give focus back to whatever had it.
  // Layout effect: it must read activeElement before Radix's FocusScope moves focus.
  React.useLayoutEffect(() => {
    if (open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      return;
    }
    const el = returnFocus.current;
    returnFocus.current = null;
    if (el?.isConnected) requestAnimationFrame(() => document.activeElement === document.body && el.focus());
  }, [open]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      const target = e.target as HTMLElement;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
      if (e.key === "?" && !typing && !open) {
        e.preventDefault();
        setHelp((h) => !h);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const { home, groups } = visibleNav(role);
  const navItems: { leaf: NavLeaf; groupKey?: string }[] = [
    ...(home ? [{ leaf: home }] : []),
    ...groups.flatMap((g) => g.items.map((leaf) => ({ leaf, groupKey: g.key }))),
  ];
  const navRows = navItems.map(({ leaf, groupKey }) => {
    const label = t(`nav.${leaf.key}`);
    const group = groupKey ? t(`nav.${groupKey}`) : "";
    return {
      leaf,
      label,
      group,
      value: `${group} ${label}`,
      keywords: leaf.oldKey ? [t(`navOld.${leaf.oldKey}`)] : [],
    };
  });
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const kbdHint = isMac ? "⌘K" : "Ctrl K";

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const actions =
    role === "admin"
      ? [
          { key: "newOrder", href: "/app/sell/orders/new", Icon: PlusCircle },
          { key: "newProduct", href: "/app/catalog/products/new", Icon: Package },
          { key: "newSupplier", href: "/app/money/suppliers/new", Icon: Building2 },
          { key: "addAdSpend", href: "/app/money/ad-spend", Icon: Megaphone },
        ].map((a) => ({ ...a, value: t(`cmd.${a.key}`) }))
      : [];
  const noNavMatch = query.trim() !== "" && !hasPaletteMatch([...navRows, ...actions], query);

  return (
    <>
      {/* span (not button) — children is itself a <button>; nesting buttons is invalid HTML */}
      <span onClick={() => setOpen(true)} className="contents">
        {children}
      </span>

      <CommandDialog open={open} onOpenChange={setOpen} filter={paletteFilter}>
        <CommandInput placeholder={t("cmd.placeholder")} value={query} onValueChange={setQuery} />
        <div role="status" className="text-sm text-muted-foreground empty:hidden px-4 py-2">
          {noNavMatch ? t("cmd.noNavMatch") : null}
        </div>
        <CommandList>
          {query.trim() ? null : <CommandEmpty>{t("cmd.empty")}</CommandEmpty>}
          <CommandGroup heading={t("cmd.navigate")}>
            {navRows.map(({ leaf: n, label, group, value, keywords }) => (
              <CommandItem key={n.href} value={value} keywords={keywords} onSelect={() => go(n.href)}>
                <n.icon />
                {label}
                {group ? <span className="ms-auto text-xs text-muted-foreground">{group}</span> : null}
              </CommandItem>
            ))}
          </CommandGroup>
          {actions.length ? (
            <CommandGroup heading={t("cmd.actions")}>
              {actions.map((a) => (
                <CommandItem key={a.href} value={a.value} onSelect={() => go(a.href)}>
                  <a.Icon />
                  {a.value}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {query.trim() ? (
            <CommandGroup heading={t("cmd.search")} forceMount>
              {role === "admin" ? (
                <CommandItem
                  value={`orders:${query}`}
                  forceMount
                  onSelect={() => go(`/app/sell/orders?q=${encodeURIComponent(query.trim())}`)}
                >
                  <Hash />
                  {t("cmd.searchOrders", { q: query.trim() })}
                </CommandItem>
              ) : null}
              <CommandItem
                value={`customers:${query}`}
                forceMount
                onSelect={() => go(`/app/sell/customers?q=${encodeURIComponent(query.trim())}`)}
              >
                <Users />
                {t("cmd.searchCustomers", { q: query.trim() })}
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>

      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("shortcuts.title")}</DialogTitle>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span>{t("shortcuts.palette")}</span>
              <kbd dir="ltr" className="rounded border border-border px-1.5 py-0.5 text-xs">{kbdHint}</kbd>
            </li>
            <li className="flex items-center justify-between">
              <span>{t("shortcuts.help")}</span>
              <kbd dir="ltr" className="rounded border border-border px-1.5 py-0.5 text-xs">?</kbd>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
