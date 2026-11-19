"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export type ComboboxOption = {
  value: string;
  label: string;
  keywords?: string[];
  icon?: React.ReactNode;
};

/**
 * Searchable single-select (Popover + Command). Keyboard-first, surfaced on
 * --surface-raised. Posts `value` via a hidden input when `name` is set so it
 * works inside plain server-action forms. Optional inline "+ Create" row.
 */
export function Combobox({
  options,
  value,
  onChange,
  name,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No matches.",
  disabled,
  disabledReason,
  className,
  ariaLabel,
  onCreate,
  createLabel = (q) => `Create "${q}"`,
}: {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  ariaLabel?: string;
  onCreate?: (label: string) => void;
  createLabel?: (query: string) => string;
}) {
  const [open, setOpen] = React.useState(false);
  const [internal, setInternal] = React.useState(value ?? "");
  const [query, setQuery] = React.useState("");
  const current = value ?? internal;
  const selected = options.find((o) => o.value === current);

  function select(v: string) {
    setInternal(v);
    onChange?.(v);
    setOpen(false);
  }

  const showCreate =
    onCreate && query.trim().length > 0 && !options.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? <input type="hidden" name={name} value={current} /> : null}
      <PopoverTrigger
        disabled={disabled}
        aria-label={ariaLabel}
        title={disabled ? disabledReason : undefined}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !selected && "text-faint",
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <span dir="auto" className="truncate text-start">{selected ? selected.label : (placeholder ?? searchPlaceholder)}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  keywords={o.keywords}
                  onSelect={() => select(o.value)}
                >
                  {o.icon}
                  <span className="truncate">{o.label}</span>
                  {current === o.value ? <Check className="ms-auto h-4 w-4 text-primary" /> : null}
                </CommandItem>
              ))}
              {showCreate ? (
                <CommandItem
                  value={`__create__${query}`}
                  onSelect={() => {
                    onCreate?.(query.trim());
                    setOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  {createLabel(query.trim())}
                </CommandItem>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
