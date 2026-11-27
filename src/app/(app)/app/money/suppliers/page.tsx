import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { sortRows } from "@/lib/utils";
import { fetchAll, lastPage, pageHref, pageRange, parsePage } from "@/lib/list-pagination";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { SuppliersTable, type SupplierRow } from "./suppliers-table";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const t = await getTranslations();
  const supabase = await createClient();

  // Spend totals and sorting cover every supplier, so both reads load in full.
  const [contacts, expenses] = await Promise.all([
    fetchAll((from, to) =>
      supabase.from("contacts").select("id, name, type, phones, location, created_at").order("id").range(from, to),
    ),
    fetchAll((from, to) =>
      supabase.from("expenses").select("contact_id, amount_dzd").not("contact_id", "is", null).order("id").range(from, to),
    ),
  ]);

  const totalByContact = new Map<string, number>();
  for (const e of expenses) {
    if (!e.contact_id) continue;
    totalByContact.set(e.contact_id, (totalByContact.get(e.contact_id) ?? 0) + (e.amount_dzd ?? 0));
  }

  // Newest first by default; the sorts are stable, so ties stay in id order.
  const newestFirst = sortRows(contacts, { created: (c) => c.created_at }, "created", "desc");
  const sorted: SupplierRow[] = sortRows(
    newestFirst.map((c) => ({
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

  const page = parsePage(sp.page);
  const last = lastPage(sorted.length);
  if (page > last) redirect(pageHref("/app/money/suppliers", sp, "page", last));
  const [start, end] = pageRange(page);

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.suppliers")} subtitle={t("navPurpose.suppliers")}>
        <ButtonLink href="/app/money/suppliers/new">
          <Plus />
          {t("contacts.newSupplier")}
        </ButtonLink>
      </PageHeader>

      <SuppliersTable rows={sorted.slice(start, end + 1)} total={sorted.length} />
    </div>
  );
}
