import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { ExpenseForm } from "../expense-form";

export default async function NewExpensePage() {
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("expenses.new")} />
      <ExpenseForm />
    </div>
  );
}
