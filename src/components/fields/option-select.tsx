"use client";

import * as React from "react";
import { Check, Plus, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import type { StatusToken } from "@/lib/statuses";
import { Combobox } from "@/components/ui/combobox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export type Option = { value: string; label: string; token?: StatusToken };

const PALETTE: StatusToken[] = ["info", "success", "warning", "violet", "cyan", "orange", "indigo", "rose"];

/** Deterministic auto color for a user-created option. */
export function autoToken(value: string): StatusToken {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/**
 * Notion-style single select with inline "+ Create". `onCreate` is called with
 * the typed label (option-sets backend is wired in phase 12).
 */
export function OptionSelect({
  options,
  value,
  onChange,
  name,
  onCreate,
  placeholder,
}: {
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  onCreate?: (label: string) => void;
  placeholder?: string;
}) {
  return (
    <Combobox
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      value={value}
      onChange={onChange}
      name={name}
      placeholder={placeholder}
      onCreate={onCreate}
    />
  );
}

/** Notion-style multi select: chips in the trigger, type to filter, "+ Create" row. */
export function OptionMultiSelect({
  options,
  value = [],
  onChange,
  name,
  onCreate,
  placeholder = "Select…",
}: {
  options: Option[];
  value?: string[];
  onChange?: (value: string[]) => void;
  name?: string;
  onCreate?: (label: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(value);
  const [query, setQuery] = React.useState("");

  function toggle(v: string) {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    setSelected(next);
    onChange?.(next);
  }

  const byValue = new Map(options.map((o) => [o.value, o]));
  const showCreate =
    onCreate && query.trim() && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? selected.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
      <PopoverTrigger
        className={cn(
          "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !selected.length && "text-faint",
        )}
      >
        <span className="flex flex-wrap items-center gap-1">
          {selected.length
            ? selected.map((v) => (
                <Chip key={v} token={byValue.get(v)?.token ?? autoToken(v)} size="sm">
                  {byValue.get(v)?.label ?? v}
                </Chip>
              ))
            : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                  <Chip token={o.token ?? autoToken(o.value)} size="sm">
                    {o.label}
                  </Chip>
                  {selected.includes(o.value) ? <Check className="ms-auto h-4 w-4 text-primary" /> : null}
                </CommandItem>
              ))}
              {showCreate ? (
                <CommandItem value={`__create__${query}`} onSelect={() => onCreate?.(query.trim())}>
                  <Plus className="h-4 w-4" />
                  Create &quot;{query.trim()}&quot;
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
