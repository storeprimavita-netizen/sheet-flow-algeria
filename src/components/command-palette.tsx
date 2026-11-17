"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PlusCircle, Package, Building2, Megaphone, Users } from "lucide-react";

import type { Role } from "@/lib/roles";
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
import { navLeaves } from "@/components/nav-model";

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

  const navItems = navLeaves(role);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const actions =
    role === "admin"
      ? [
          { key: "newOrder", href: "/app/orders/new", Icon: PlusCircle },
          { key: "newProduct", href: "/app/products/new", Icon: Package },
          { key: "newSupplier", href: "/app/contacts/suppliers/new", Icon: Building2 },
          { key: "addAdSpend", href: "/app/finance/ad-spend", Icon: Megaphone },
        ]
      : [];

  return (
    <>
      {/* span (not button) — children is itself a <button>; nesting buttons is invalid HTML */}
      <span onClick={() => setOpen(true)} className="contents">
        {children}
      </span>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("cmd.placeholder")} value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>{t("cmd.empty")}</CommandEmpty>
          <CommandGroup heading={t("cmd.navigate")}>
            {navItems.map((n) => (
              <CommandItem
                key={n.href}
                value={t(`nav.${n.key}`)}
                keywords={n.oldKey ? [t(`navOld.${n.oldKey}`)] : undefined}
                onSelect={() => go(n.href)}
              >
                <n.icon />
                {t(`nav.${n.key}`)}
              </CommandItem>
            ))}
          </CommandGroup>
          {actions.length ? (
            <CommandGroup heading={t("cmd.actions")}>
              {actions.map((a) => (
                <CommandItem key={a.href} value={t(`cmd.${a.key}`)} onSelect={() => go(a.href)}>
                  <a.Icon />
                  {t(`cmd.${a.key}`)}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {query.trim() ? (
            <CommandGroup heading={t("cmd.search")}>
              <CommandItem
                value={`customers:${query}`}
                onSelect={() => go(`/app/contacts?q=${encodeURIComponent(query.trim())}`)}
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
              <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">⌘K</kbd>
            </li>
            <li className="flex items-center justify-between">
              <span>{t("shortcuts.help")}</span>
              <kbd className="rounded border border-border px-1.5 py-0.5 text-xs">?</kbd>
            </li>
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
