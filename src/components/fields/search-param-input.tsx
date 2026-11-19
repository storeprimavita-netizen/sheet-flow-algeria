"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { createSearchSync } from "./search-param-sync";

export type SearchBoxHandle = { mergeInto: (params: URLSearchParams) => void };

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
  React.useImperativeHandle(syncRef, () => ({ mergeInto: sync.mergeInto }), [sync]);
  React.useEffect(() => {
    sync.seen(query, inherited);
  }, [sync, query, inherited]);
  React.useEffect(() => () => sync.cancel(), [sync]);

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
