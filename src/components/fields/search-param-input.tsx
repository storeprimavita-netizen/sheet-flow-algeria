"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";

/** Search-as-you-type bound to a URL param (default `q`), debounced 300ms;
 * the server page reads the param, so results stay shareable/bookmarkable. */
export function SearchParamInput({ placeholder, param = "q" }: { placeholder: string; param?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [value, setValue] = React.useState(sp.get(param) ?? "");

  React.useEffect(() => {
    if (value === (sp.get(param) ?? "")) return;
    const id = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (value.trim()) next.set(param, value.trim());
      else next.delete(param);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [value, sp, param, pathname, router]);

  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="ps-9" aria-label={placeholder} />
    </div>
  );
}
