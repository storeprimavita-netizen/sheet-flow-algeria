"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

export type MultiSelectOption = { value: string; label: string };

/** Searchable checklist for filter bars with too many options for a native
 * `<select multiple>` (e.g. 58 wilayas) to be usable. Selections post as
 * repeated `name=value` query params via hidden inputs, same as a native
 * multi-select — the enclosing `<form method="get">` needs no JS. */
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

  return (
    <div className="space-y-1.5 rounded-md border border-input p-1.5">
      {selectedOptions.length > 0 ? (
        <div className="flex flex-wrap gap-1">
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
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("common.searchPlaceholder")}
        className="h-7 w-full rounded border-0 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
      />
      <div className="max-h-32 overflow-auto">
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
      {[...selected].map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
