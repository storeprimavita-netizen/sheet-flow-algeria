import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";
import { ContactTabs } from "../tabs";

export default async function SuppliersPage() {
  const t = await getTranslations();
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.title")} subtitle={t("contacts.subtitle")}>
        <ButtonLink href="/app/contacts/suppliers/new">
          <Plus />
          {t("contacts.newSupplier")}
        </ButtonLink>
      </PageHeader>

      <ContactTabs active="suppliers" />

      {!contacts?.length ? (
        <Empty>{t("contacts.suppliersNone")}</Empty>
      ) : (
        <div className="card-surface overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.name")}</th>
                  <th>{t("fields.type")}</th>
                  <th>{t("fields.phone")}</th>
                  <th>{t("fields.location")}</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td>
                      <Link href={`/app/contacts/suppliers/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <Badge variant="secondary">{t(`status.supplier_type.${c.type}`)}</Badge>
                    </td>
                    <td className="text-muted-foreground">
                      {c.phones.length ? c.phones.join(", ") : "—"}
                    </td>
                    <td className="text-muted-foreground">{c.location ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
