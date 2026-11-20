"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";

import type { Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { activeBarHref, bottomBar, type CounterKey } from "@/components/nav-model";

const itemClass =
  "relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-medium transition-colors";

/** Phone-only bottom bar (< md): the role's top destinations + "More", which opens the drawer. */
export function MobileBottomBar({
  role,
  counts,
  onMore,
  moreRef,
}: {
  role: Role | null;
  counts: Record<CounterKey, number>;
  onMore: () => void;
  moreRef?: React.Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("nav");
  const active = activeBarHref(role, usePathname());
  return (
    <nav
      aria-label={t("bottomBar")}
      className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {bottomBar(role).map((leaf) => {
        const Icon = leaf.icon;
        const isActive = active === leaf.href;
        const n = leaf.counter ? counts[leaf.counter] ?? 0 : 0;
        return (
          <Link
            key={leaf.href}
            href={leaf.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(itemClass, isActive ? "text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <span className="relative">
              <Icon className="h-5 w-5" aria-hidden />
              {n > 0 ? (
                <span className="num absolute -top-1.5 start-full -ms-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 text-primary-foreground">
                  {n > 99 ? "99+" : n}
                </span>
              ) : null}
            </span>
            <span className="max-w-full truncate">{t(leaf.key)}</span>
          </Link>
        );
      })}
      <button
        ref={moreRef}
        type="button"
        onClick={onMore}
        className={cn(itemClass, "text-muted-foreground hover:text-foreground")}
      >
        <Menu className="h-5 w-5" aria-hidden />
        <span className="max-w-full truncate">{t("more")}</span>
      </button>
    </nav>
  );
}
