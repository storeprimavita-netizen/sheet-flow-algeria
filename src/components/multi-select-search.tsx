"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type MultiSelectOption = { value: string; label: string };

/** Searchable multi-select popover for filter bars with too many options for
 * a native `<select multiple>` (e.g. 58 wilayas) to be usable. Closed by
 * default like a real dropdown; opens on click, closes on outside
 * click/Escape. Selections post as repeated `name=value` query params via
 * hidden inputs, same as a native multi-select — the enclosing
 * `<form method="get">` needs no JS beyond this control. */
export function MultiSelectSearch({
  name,
  options,
  defaultValues = [],
}: {
  name: string;
  options: MultiSelectOption[];
  defaultValues?: string[];
}) {
  const t = useTranslations();
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultValues));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [query, options]);

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const selectedOptions = options.filter((o) => selected.has(o.value));
  const summary =
    selectedOptions.length === 0
      ? t("common.all")
      : selectedOptions.length === 1
        ? selectedOptions[0].label
        : `${selectedOptions.length} ${t("common.selected")}`;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-start text-sm shadow-sm"
      >
        <span className={cn("truncate", selectedOptions.length === 0 && "text-muted-foreground")}>{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open ? (
        <div className="absolute start-0 top-full z-20 mt-1 w-full min-w-56 space-y-1.5 rounded-md border border-input bg-popover p-1.5 shadow-md">
          {selectedOptions.length > 0 ? (
            <div className="flex flex-wrap gap-1 border-b border-border pb-1.5">
              {selectedOptions.map((o) => (
                <span
                  key={o.value}
                  className="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground"
                >
                  {o.label}
                  <button type="button" onClick={() => toggle(o.value)} className="opacity-60 hover:opacity-100">
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("common.searchPlaceholder")}
            className="h-7 w-full rounded border-0 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
          />
          <div className="max-h-40 overflow-auto">
            {filtered.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted/50"
              >
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={() => toggle(o.value)}
                  className="h-3 w-3"
                />
                {o.label}
              </label>
            ))}
            {filtered.length === 0 ? (
              <p className="px-1 py-1 text-xs text-muted-foreground">{t("common.noMatches")}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {[...selected].map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
