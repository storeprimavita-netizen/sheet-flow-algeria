import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile, requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseForm } from "../expense-form";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/app/expenses");
  const profile = (await getProfile())!;
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
      <ExpenseForm expense={expense} workspaceId={profile.workspaceId} />
    </div>
  );
}
