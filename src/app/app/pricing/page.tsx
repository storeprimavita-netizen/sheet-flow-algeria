import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/rbac";
import { loadScenarios } from "@/lib/pricing-server";
import { PageHeader } from "@/components/page-header";
import { ScenarioEngine } from "./scenario-engine";

export default async function PricingPage() {
  await requireAdmin("/app/pricing");
  const t = await getTranslations();
  const initial = await loadScenarios(null);

  return (
    <div className="space-y-6">
      <PageHeader title={t("pricing.title")} subtitle={t("pricing.subtitleGeneral")} />
      <ScenarioEngine productId={null} initial={initial} />
    </div>
  );
}
