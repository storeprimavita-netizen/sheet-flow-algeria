import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { sortRows } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { ContactTabs } from "@/app/(app)/app/sell/customers/tabs";
import { SuppliersTable, type SupplierRow } from "./suppliers-table";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = await getTranslations();
  const supabase = await createClient();

  const [{ data: contacts }, { data: expenses }] = await Promise.all([
    supabase.from("contacts").select("*").order("created_at", { ascending: false }),
    supabase.from("expenses").select("contact_id, amount_dzd").not("contact_id", "is", null),
  ]);

  const totalByContact = new Map<string, number>();
  for (const e of expenses ?? []) {
    if (!e.contact_id) continue;
    totalByContact.set(e.contact_id, (totalByContact.get(e.contact_id) ?? 0) + (e.amount_dzd ?? 0));
  }

  const rows: SupplierRow[] = sortRows(
    (contacts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      phones: c.phones ?? [],
      location: c.location,
      expensesTotal: totalByContact.get(c.id) ?? 0,
    })),
    { name: (r) => r.name.toLowerCase(), expenses: (r) => r.expensesTotal },
    typeof sp.sort === "string" ? sp.sort : null,
    sp.dir === "desc" ? "desc" : "asc",
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.suppliers")} subtitle={t("navPurpose.suppliers")}>
        <ButtonLink href="/app/money/suppliers/new">
          <Plus />
          {t("contacts.newSupplier")}
        </ButtonLink>
      </PageHeader>

      <ContactTabs active="suppliers" />

      <SuppliersTable rows={rows} />
    </div>
  );
}
