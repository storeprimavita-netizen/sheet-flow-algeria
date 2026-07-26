import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/delete-button";
import { tableClass } from "@/components/field";
import { ContactForm } from "../../contact-form";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const [{ data: contact }, { data: expenses }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("expenses")
      .select("id, amount_dzd, category, spent_on, note, product:products(name)")
      .eq("contact_id", id)
      .order("spent_on", { ascending: false }),
  ]);

  if (!contact) notFound();

  const total = (expenses ?? []).reduce((sum, e) => sum + (e.amount_dzd ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.editSupplier")} subtitle={contact.name}>
        <DeleteButton table="contacts" id={contact.id} redirectTo="/app/contacts/suppliers" />
      </PageHeader>
      <ContactForm contact={contact} />

      <section className="glass-card space-y-4 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("contacts.linkedExpenses")}</h2>
          <span className="text-sm text-muted-foreground">
            {t("common.total")}: {formatCurrency(total)}
          </span>
        </div>

        {!expenses?.length ? (
          <p className="text-sm text-muted-foreground">{t("contacts.noExpenses")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.incurred_on")}</th>
                  <th>{t("fields.product")}</th>
                  <th>{t("fields.category")}</th>
                  <th>{t("fields.amount")}</th>
                  <th>{t("fields.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="text-muted-foreground">{formatDate(e.spent_on)}</td>
                    <td className="text-muted-foreground">{e.product?.name ?? "—"}</td>
                    <td>{t(`status.expense_category.${e.category}`)}</td>
                    <td>{formatCurrency(e.amount_dzd)}</td>
                    <td className="text-muted-foreground">{e.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
