import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
import { useStatusLabel } from "@/components/status-labels-provider";
import { startsWithEmoji } from "@/lib/emoji";
import { getStatus, type StatusKind } from "@/lib/statuses";

/** The one status renderer: dot + icon + label, tinted bg + strong fg.
 * `compact` swaps the full label for a one-word `.short` key — tables use it
 * to keep the Status column narrow; the order-detail workflow keeps full labels. */
export function StatusPill({
  kind,
  status,
  size = "md",
  showIcon = true,
  compact = false,
}: {
  kind: StatusKind;
  status: string;
  size?: "sm" | "md";
  showIcon?: boolean;
  compact?: boolean;
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
  const iconShown = showIcon && !startsWithEmoji(text);
  return (
    <Chip
      token={def.token}
      size={size}
      icon={iconShown ? <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} /> : undefined}
    >
      {compact && overridden ? (
        <span className="max-w-[9rem] truncate" title={text}>
          {text}
        </span>
      ) : (
        text
      )}
    </Chip>
  );
}
