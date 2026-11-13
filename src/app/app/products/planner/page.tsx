import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { defaultInputs, loadScenarios } from "../pricing-data";
import { ScenarioEngine } from "../scenario-engine";

export default async function PricingPlannerPage() {
  const t = await getTranslations();
  const profile = (await getProfile())!;

  const supabase = await createClient();
  const seed = await defaultInputs(supabase, profile.workspaceId);
  const initial = await loadScenarios(supabase, null, seed);

  return (
    <div className="space-y-6">
      <PageHeader title={t("pricing.title")} subtitle={t("pricing.subtitleGeneral")} />
      <ScenarioEngine workspaceId={profile.workspaceId} productId={null} initial={initial} />
    </div>
  );
}
