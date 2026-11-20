"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { crumbsFor } from "@/components/nav-model";
import type { Role } from "@/lib/roles";

const RecordCtx = createContext<((label: string | null) => void) | null>(null);

/** Holds the record name a detail page supplies via <CrumbRecord>. */
export function CrumbProvider({ role, children }: { role: Role | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const [rec, setRec] = useState<{ path: string; label: string } | null>(null);
  const label = rec && rec.path === pathname ? rec.label : null;
  return (
    <RecordCtx.Provider value={(l) => setRec(l ? { path: pathname, label: l } : null)}>
      <CrumbsContext.Provider value={{ role, label }}>{children}</CrumbsContext.Provider>
    </RecordCtx.Provider>
  );
}

const CrumbsContext = createContext<{ role: Role | null; label: string | null }>({ role: null, label: null });

/** Render inside a detail page to put the record name at the end of the trail. */
export function CrumbRecord({ label }: { label: string }) {
  const set = useContext(RecordCtx);
  useEffect(() => {
    set?.(label);
    return () => set?.(null);
  }, [set, label]);
  return null;
}

export function Breadcrumbs() {
  const t = useTranslations();
  const pathname = usePathname();
  const { role, label } = useContext(CrumbsContext);
  const crumbs: { label: string; href?: string }[] = crumbsFor(role, pathname).map((c) => ({
    label: t(c.labelKey),
    href: c.href,
  }));
  if (label) crumbs.push({ label });
  if (crumbs.length === 0) return null;
  const collapse = crumbs.length > 2;
  return (
    <nav aria-label={t("nav.breadcrumb")} className="min-w-0 flex-1 text-sm text-muted-foreground">
      <ol className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
        {collapse ? (
          <li aria-hidden="true" className="flex items-center gap-1 sm:hidden">
            …
          </li>
        ) : null}
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li
              key={i}
              className={`flex min-w-0 items-center gap-1 ${collapse && i === 0 ? "max-sm:hidden" : ""} ${last ? "text-foreground" : "shrink-0"}`}
            >
              {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0 rtl:rotate-180" aria-hidden="true" /> : null}
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className="truncate">
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
