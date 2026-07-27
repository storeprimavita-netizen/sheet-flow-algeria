import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";

import { Chip } from "@/components/ui/chip";

/**
 * Risk-score pill — same grammar as status pills: green shield-check /
 * amber shield-alert / red shield-x, reason on hover.
 * Shared by the confirmation queue + Contacts customer views.
 */
export function RiskBadge({ score, reason, size = "sm" }: { score: number; reason?: string; size?: "sm" | "md" }) {
  const t = useTranslations();
  const { token, Icon } =
    score >= 60
      ? { token: "danger" as const, Icon: ShieldX }
      : score >= 30
        ? { token: "warning" as const, Icon: ShieldAlert }
        : { token: "success" as const, Icon: ShieldCheck };

  return (
    <span title={reason}>
      <Chip token={token} size={size} icon={<Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} />}>
        {t("fields.risk")}: <span className="num">{score}</span>
      </Chip>
    </span>
  );
}
