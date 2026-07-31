import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";
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
  const def = getStatus(kind, status);
  if (!def) {
    return (
      <Chip token="neutral" size={size} dot>
        {status}
      </Chip>
    );
  }
  const Icon = def.icon;
  return (
    <Chip
      token={def.token}
      size={size}
      icon={showIcon ? <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} /> : undefined}
    >
      {t(compact ? def.label.replace(/^status\./, "status.short.") : def.label)}
    </Chip>
  );
}
