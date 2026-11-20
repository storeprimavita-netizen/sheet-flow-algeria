"use client";

import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
import { useStatusLabel } from "@/components/status-labels-provider";
import { isEmojiOnly, splitLeadingEmoji } from "@/lib/emoji";
import { getStatus, type StatusKind } from "@/lib/statuses";

/** The one status renderer: dot + icon + label, tinted bg + strong fg.
 * `compact` swaps the full label for a one-word `.short` key — tables use it
 * to keep the Status column narrow; the order-detail workflow keeps full labels.
 * Long labels truncate by default (9rem, pill shrinks inside its cell); select triggers pass `truncate={false}` to show the full text. */
export function StatusPill({
  kind,
  status,
  size = "md",
  showIcon = true,
  compact = false,
  truncate = true,
}: {
  kind: StatusKind;
  status: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  compact?: boolean;
  truncate?: boolean;
}) {
  const t = useTranslations();
  const statusLabel = useStatusLabel();
  const def = getStatus(kind, status);
  if (!def) {
    return (
      <Chip token="neutral" size={size} dot>
        {status}
      </Chip>
    );
  }
  const Icon = def.icon;
  const fullDefault = t(def.label);
  const full = statusLabel(kind, status, fullDefault);
  const overridden = full !== fullDefault;
  // compact: the override replaces the short word (long text is truncated, full text in the title)
  const text = compact && !overridden ? t(def.label.replace(/^status\./, "status.short.")) : full;
  // an emoji in the label stands in for the Lucide icon
  const lead = splitLeadingEmoji(text);
  const iconShown = showIcon && !lead;
  return (
    <Chip
      token={def.token}
      size={size}
      className={truncate ? "min-w-0 max-w-full" : undefined}
      icon={iconShown ? <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} /> : undefined}
    >
      {overridden && isEmojiOnly(text) ? <span className="sr-only">{fullDefault}</span> : null}
      <span className={truncate ? "inline-flex min-w-0 max-w-[9rem] items-center gap-1" : "inline-flex items-center gap-1"} title={truncate && !isEmojiOnly(text) ? text : undefined}>
        {lead ? <span className="shrink-0">{lead.emoji}</span> : null}
        {lead ? (lead.rest ? <span className={truncate ? "truncate" : undefined}>{lead.rest}</span> : null) : <span className={truncate ? "truncate" : undefined}>{text}</span>}
      </span>
    </Chip>
  );
}
