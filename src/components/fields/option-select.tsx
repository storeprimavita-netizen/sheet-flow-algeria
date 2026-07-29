"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Plus, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import type { StatusToken } from "@/lib/statuses";
import { createOption } from "@/lib/option-sets-actions";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

export type Option = { value: string; label: string; token?: StatusToken; archived?: boolean };

/** Options minus archived ones, except the currently-selected value(s) — archived options stay visible on historical records but aren't offered for new picks. */
function pickable(options: Option[], selected: string | string[] | undefined) {
  const kept = new Set(Array.isArray(selected) ? selected : selected ? [selected] : []);
  return options.filter((o) => !o.archived || kept.has(o.value));
}

/**
 * Notion-style single select with inline "+ Create". Pass `setKey` (an
 * `OptionSetKey`) to back it with the real `option_sets`/`options` tables —
 * creating calls the shared `createOption` server action, any authenticated
 * role may use it. Without `setKey`, falls back to the caller's own
 * `onCreate` (used by the design-preview gallery with static demo options).
 */
export function OptionSelect({
  setKey,
  options,
  value,
  onChange,
  name,
  onCreate,
  placeholder,
  disabled,
}: {
  setKey?: string;
  options: Option[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  onCreate?: (label: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState(options);
  const [selected, setSelected] = React.useState(value);
  const [query, setQuery] = React.useState("");
  React.useEffect(() => setOpts(options), [options]);
  React.useEffect(() => setSelected(value), [value]);

  function select(v: string) {
    setSelected(v);
    onChange?.(v);
    setOpen(false);
  }

  async function handleCreate(label: string) {
    if (!setKey) return onCreate?.(label);
    const res = await createOption(setKey, label);
    if (!res.ok) return toast.error(res.error);
    setOpts((prev) => [...prev, { value: res.option.id, label: res.option.label, token: res.option.color_token as StatusToken }]);
    select(res.option.id);
  }

  const list = pickable(opts, selected);
  const current = list.find((o) => o.value === selected);
  const showCreate = query.trim() && !list.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? <input type="hidden" name={name} value={selected ?? ""} /> : null}
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !current && "text-faint",
        )}
      >
        {current ? (
          <span title={current.archived ? "Archived option" : undefined}>
            <Chip token={current.token ?? "neutral"} size="sm" className={current.archived ? "opacity-60" : undefined}>
              {current.label}
            </Chip>
          </span>
        ) : (
          <span className="truncate">{placeholder}</span>
        )}
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No matches.</CommandEmpty>
            <CommandGroup>
              {list.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => select(o.value)}>
                  <Chip token={o.token ?? "neutral"} size="sm">
                    {o.label}
                  </Chip>
                  {selected === o.value ? <Check className="ms-auto h-4 w-4 text-primary" /> : null}
                </CommandItem>
              ))}
              {showCreate ? (
                <CommandItem value={`__create__${query}`} onSelect={() => handleCreate(query.trim())}>
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

/** Notion-style multi select: chips in the trigger, type to filter, "+ Create" row. Same `setKey` wiring as `OptionSelect`. */
export function OptionMultiSelect({
  setKey,
  options,
  value = [],
  onChange,
  name,
  onCreate,
  placeholder = "Select…",
  disabled,
}: {
  setKey?: string;
  options: Option[];
  value?: string[];
  onChange?: (value: string[]) => void;
  name?: string;
  onCreate?: (label: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState(options);
  const [selected, setSelected] = React.useState<string[]>(value);
  const [query, setQuery] = React.useState("");
  React.useEffect(() => setOpts(options), [options]);
  React.useEffect(() => setSelected(value), [value]);

  function toggle(v: string) {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    setSelected(next);
    onChange?.(next);
  }

  async function handleCreate(label: string) {
    if (!setKey) {
      onCreate?.(label);
      return;
    }
    const res = await createOption(setKey, label);
    if (!res.ok) return toast.error(res.error);
    setOpts((prev) => [...prev, { value: res.option.id, label: res.option.label, token: res.option.color_token as StatusToken }]);
    const next = [...selected, res.option.id];
    setSelected(next);
    onChange?.(next);
  }

  const list = pickable(opts, selected);
  const byValue = new Map(list.map((o) => [o.value, o]));
  const showCreate = query.trim() && !list.some((o) => o.label.toLowerCase() === query.trim().toLowerCase());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {name ? selected.map((v) => <input key={v} type="hidden" name={name} value={v} />) : null}
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          "flex min-h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !selected.length && "text-faint",
        )}
      >
        <span className="flex flex-wrap items-center gap-1">
          {selected.length
            ? selected.map((v) => (
                <span key={v} title={byValue.get(v)?.archived ? "Archived option" : undefined}>
                  <Chip token={byValue.get(v)?.token ?? "neutral"} size="sm" className={byValue.get(v)?.archived ? "opacity-60" : undefined}>
                    {byValue.get(v)?.label ?? v}
                  </Chip>
                </span>
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
              {list.map((o) => (
                <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                  <Chip token={o.token ?? "neutral"} size="sm">
                    {o.label}
                  </Chip>
                  {selected.includes(o.value) ? <Check className="ms-auto h-4 w-4 text-primary" /> : null}
                </CommandItem>
              ))}
              {showCreate ? (
                <CommandItem value={`__create__${query}`} onSelect={() => handleCreate(query.trim())}>
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
