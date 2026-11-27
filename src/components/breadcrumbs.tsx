"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { nextRecord, type Rec, type StoredRec } from "@/components/breadcrumb-record";
import { crumbsFor } from "@/components/nav-model";
import type { Role } from "@/lib/roles";


const RecordCtx = createContext<((rec: Rec | null) => void) | null>(null);
const CrumbsContext = createContext<{ role: Role | null; rec: Rec | null }>({ role: null, rec: null });

/** Holds the record name a detail page supplies via <CrumbRecord>. */
export function CrumbProvider({ role, children }: { role: Role | null; children: React.ReactNode }) {
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const [stored, setStored] = useState<StoredRec | null>(null);
  // Stable identity: consumers' effects must not re-run when the provider re-renders.
  const set = useCallback((rec: Rec | null) => {
    setStored((prev) => nextRecord(prev, rec, pathRef.current));
  }, []);
  const rec = stored && stored.path === pathname ? stored : null;
  const value = useMemo(() => ({ role, rec }), [role, rec]);
  return (
    <RecordCtx.Provider value={set}>
      <CrumbsContext.Provider value={value}>{children}</CrumbsContext.Provider>
    </RecordCtx.Provider>
  );
}

/**
 * Render inside a detail page to put the record name at the end of the trail.
 * `href` makes the record a link (e.g. to an editor) and `tail` adds a final
 * plain item after it (e.g. "Preview").
 */
export function CrumbRecord({ label, href, tail }: { label: string; href?: string; tail?: string }) {
  const set = useContext(RecordCtx);
  // A layout stays mounted across tab switches: re-register the record for the new path.
  const pathname = usePathname();
  useEffect(() => {
    set?.({ label, href, tail });
    return () => set?.(null);
  }, [set, label, href, tail, pathname]);
  return null;
}

export function Breadcrumbs() {
  const t = useTranslations();
  const pathname = usePathname();
  const { role, rec } = useContext(CrumbsContext);
  const crumbs: { label: string; href?: string }[] = crumbsFor(role, pathname).map((c) => ({
    label: t(c.labelKey),
    href: c.href,
  }));
  if (rec) crumbs.push({ label: rec.label, href: rec.href });
  if (rec?.tail) crumbs.push({ label: rec.tail });
  if (crumbs.length === 0) return null;
  const collapse = crumbs.length > 2;
  return (
    <nav aria-label={t("nav.breadcrumb")} className="min-w-0 flex-1 text-sm text-muted-foreground">
      <ol className="flex items-center gap-1 overflow-hidden whitespace-nowrap">
        {collapse ? (
          // Decorative on phones: the group hub is reachable from the sidebar.
          <li aria-hidden="true" className="flex items-center gap-1 sm:hidden">
            …
          </li>
        ) : null}
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          // The record shrinks (so a trailing "Preview" stays visible); parents keep their width.
          const shrinkable = last || (rec?.tail && i === crumbs.length - 2);
          return (
            <li
              key={i}
              className={`flex min-w-0 items-center gap-1 ${collapse && i === 0 ? "max-sm:hidden" : ""} ${last ? "text-foreground max-sm:min-w-[40%]" : shrinkable ? "" : "sm:shrink-0"}`}
            >
              {i > 0 ? <ChevronRight className="h-3 w-3 shrink-0 rtl:rotate-180" aria-hidden="true" /> : null}
              {c.href && !last ? (
                <Link href={c.href} title={c.label} dir="auto" className="truncate hover:text-foreground hover:underline">
                  <bdi>{c.label}</bdi>
                </Link>
              ) : (
                <span aria-current={last ? "page" : undefined} title={c.label} dir="auto" className="truncate">
                  <bdi>{c.label}</bdi>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
