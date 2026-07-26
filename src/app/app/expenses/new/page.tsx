import { getTranslations } from "next-intl/server";

import { getProfile, requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "../expense-form";

export default async function NewExpensePage() {
  await requireAdmin("/app/expenses");
  const profile = (await getProfile())!;
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("expenses.new")} />
      <ExpenseForm workspaceId={profile.workspaceId} />
    </div>
  );
}
