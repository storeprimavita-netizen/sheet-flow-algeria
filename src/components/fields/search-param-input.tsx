"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { createSearchSync, leavesAddress } from "./search-param-sync";

export type SearchBoxHandle = { mergeInto: (params: URLSearchParams) => void; text: () => string; latest: () => string; cancel: () => void };

let active: SearchBoxHandle | null = null;
/** the queue bar's search box, when mounted (lets the saved-view bar read its text) */
export function activeSearchBox(): SearchBoxHandle | null {
  return active;
}

/** Search-as-you-type bound to a URL param (default `q`), debounced 300ms;
 * the server page reads the param, so results stay shareable/bookmarkable. */
export function SearchParamInput({
  placeholder,
  param = "q",
  inherited = "",
  clearedMarker,
  syncRef,
}: {
  placeholder: string;
  param?: string;
  /** value that applies when the URL has none (e.g. from a saved view) */
  inherited?: string;
  /** written instead of deleting the param, so a saved view's own value is cleared too */
  clearedMarker?: string;
  /** lets another writer in the same bar send the box text with its own change */
  syncRef?: React.Ref<SearchBoxHandle>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const query = sp.toString();
  const [value, setValue] = React.useState(() => {
    const u = sp.get(param);
    return u === null ? inherited : u === clearedMarker ? "" : u;
  });
  const writeRef = React.useRef<(qs: string) => void>(() => {});
  React.useEffect(() => {
    writeRef.current = (qs) => router.replace(`${pathname}?${qs}`, { scroll: false });
  });
  const [sync] = React.useState(() =>
    createSearchSync({ write: (qs) => writeRef.current(qs), onText: setValue, param, clearedMarker, initialText: value }),
  );
  const handle = React.useMemo<SearchBoxHandle>(() => ({ mergeInto: sync.mergeInto, text: sync.text, latest: sync.latest, cancel: sync.cancel }), [sync]);
  React.useImperativeHandle(syncRef, () => handle, [handle]);
  const registers = syncRef != null;
  React.useEffect(() => {
    if (!registers) return;
    active = handle;
    return () => {
      if (active === handle) active = null;
    };
  }, [registers, handle]);
  React.useEffect(() => {
    sync.seen(query, inherited);
  }, [sync, query, inherited]);
  React.useEffect(() => () => sync.cancel(), [sync]);
  React.useEffect(() => {
    // a plain click (pointer or keyboard) to another address, or on a control that drops unsent text, ends the search
    const onClick = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target : null;
      if (!el) return;
      if (el.closest("[data-search-discard]")) return sync.cancel();
      const a = el.closest("a[href]");
      if (a instanceof HTMLAnchorElement && leavesAddress({ href: a.href, target: a.target, download: a.hasAttribute("download") }, e, window.location.href)) sync.cancel();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [sync]);

  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={value} onChange={(e) => {
          setValue(e.target.value);
          sync.type(e.target.value);
        }} placeholder={placeholder} className="ps-9" aria-label={placeholder} />
    </div>
  );
}
