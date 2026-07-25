import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseForm } from "../expense-form";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: expense } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!expense) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={t("expenses.edit")}>
        <DeleteButton table="expenses" id={expense.id} redirectTo="/app/expenses" />
      </PageHeader>
      <ExpenseForm expense={expense} />
    </div>
  );
}
