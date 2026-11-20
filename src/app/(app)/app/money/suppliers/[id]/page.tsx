import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/rbac";
import { formatCurrency } from "@/lib/format";
import { getOptionSet } from "@/lib/option-sets";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/delete-button";
import { ExpenseTable } from "@/components/finance/expense-table";
import { ContactForm } from "@/app/(app)/app/sell/customers/contact-form";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();
  const profile = (await getProfile())!;

  const supabase = await createClient();
  const [{ data: contact }, { data: expenses }, { data: products }, usdRate, eurRate, subcategories] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
    supabase.from("expenses").select("*").eq("contact_id", id).order("spent_on", { ascending: false }),
    supabase.from("products").select("id, name, images, status").order("name"),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "USD" }),
    supabase.rpc("current_fx_rate", { p_ws: profile.workspaceId, p_currency: "EUR" }),
    getOptionSet(profile.workspaceId, "expense_subcategory"),
  ]);

  if (!contact) notFound();

  const rates = { USD: usdRate.data ?? 1, EUR: eurRate.data ?? 1 };
  const productOpts = (products ?? []).map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null, status: p.status }));
  const total = (expenses ?? []).reduce((sum, e) => sum + (e.amount_dzd ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.editSupplier")} subtitle={contact.name}>
        <DeleteButton table="contacts" id={contact.id} redirectTo="/app/money/suppliers" />
      </PageHeader>
      <ContactForm contact={contact} />

      <section className="card-surface space-y-4 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("contacts.linkedExpenses")}</h2>
          <span className="num text-sm text-muted-foreground">
            {t("common.total")}: {formatCurrency(total)}
          </span>
        </div>

        <ExpenseTable expenses={expenses ?? []} contactId={id} products={productOpts} suppliers={[]} subcategories={subcategories} rates={rates} />
      </section>
    </div>
  );
}
