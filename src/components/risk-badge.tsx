import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";

function riskVariant(score: number): "default" | "secondary" | "destructive" {
  if (score >= 60) return "destructive";
  if (score >= 30) return "secondary";
  return "default";
}

/** Shared risk-score pill — confirmation queue rows + Contacts customer views. */
export async function RiskBadge({ score }: { score: number }) {
  const t = await getTranslations();
  return (
    <Badge variant={riskVariant(score)}>
      {t("fields.risk")}: {score}
    </Badge>
  );
}
