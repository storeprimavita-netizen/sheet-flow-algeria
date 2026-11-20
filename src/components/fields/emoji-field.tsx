"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { SmilePlus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { emojiSchema } from "@/lib/emoji";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

/** A short, store-relevant set; anything else can be pasted into the input. */
const EMOJIS = [
  "👗", "👚", "👖", "🧥", "🧣", "👜", "👠", "👒", "💍", "🧵", "🪡", "🎀",
  "🔥", "⭐", "✨", "💎", "🌸", "🌹", "🎁", "🏷️", "💰", "📦", "🚚", "✅",
  "❌", "⚠️", "⏳", "📞", "📵", "🔁", "↩️", "🚫", "💬", "👑", "🛍️", "❤️",
];
const COLS = 6;

/**
 * Emoji picker for an option. Arrow keys move through the grid, Escape closes,
 * a pasted/typed emoji (exactly one) is accepted, clear removes it.
 * `onPick(null)` clears.
 */
export function EmojiField({
  value,
  onPick,
  disabled,
  label,
}: {
  value: string | null;
  /** Name of the option this picker belongs to (read out by screen readers). */
  label: string;
  onPick: (emoji: string | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [invalid, setInvalid] = React.useState(false);
  // roving tabindex: one cell is in the tab order (the selected one, else the first)
  const [active, setActive] = React.useState(0);
  const cells = React.useRef<(HTMLButtonElement | null)[]>([]);

  function pick(v: string | null) {
    onPick(v);
    setOpen(false);
    setText("");
    setInvalid(false);
  }

  function onGridKey(e: React.KeyboardEvent, i: number) {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step =
      e.key === "ArrowRight" ? (rtl ? -1 : 1)
      : e.key === "ArrowLeft" ? (rtl ? 1 : -1)
      : e.key === "ArrowDown" ? COLS
      : e.key === "ArrowUp" ? -COLS
      : 0;
    if (!step) return;
    e.preventDefault();
    const next = Math.min(EMOJIS.length - 1, Math.max(0, i + step));
    setActive(next);
    cells.current[next]?.focus();
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setActive(Math.max(0, EMOJIS.indexOf(value ?? "")));
        setOpen(o);
      }}
    >
      <PopoverTrigger
        disabled={disabled}
        aria-label={value ? t("settings.options.emojiTriggerSet", { option: label, emoji: value }) : t("settings.options.emojiTriggerEmpty", { option: label })}
        className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-md px-1 text-base hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        {value ?? <SmilePlus className="h-4 w-4 text-muted-foreground" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div role="group" aria-label={t("settings.options.emoji")} className="grid grid-cols-6 gap-1">
          {EMOJIS.map((e, i) => (
            <button
              key={e}
              ref={(el) => {
                cells.current[i] = el;
              }}
              type="button"
              tabIndex={i === active ? 0 : -1}
              aria-pressed={e === value}
              onClick={() => pick(e)}
              onKeyDown={(ev) => onGridKey(ev, i)}
              className={cn(
                "flex h-11 items-center justify-center rounded-md text-xl hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring sm:h-8",
                e === value && "bg-surface-raised ring-1 ring-ring",
              )}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <Input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const r = emojiSchema.safeParse(text);
              if (r.success && r.data) pick(r.data);
              else setInvalid(true);
            }}
            placeholder={t("settings.options.emojiPaste")}
            aria-label={t("settings.options.emojiPaste")}
            aria-invalid={invalid || undefined}
            className="h-8"
          />
          {value ? (
            <button
              type="button"
              aria-label={t("settings.options.emojiClear")}
              onClick={() => pick(null)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
        {invalid ? <p className="mt-1 text-xs text-danger">{t("settings.options.emojiInvalid")}</p> : null}
      </PopoverContent>
    </Popover>
  );
}
