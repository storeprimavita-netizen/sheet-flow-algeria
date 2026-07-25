import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";

export default async function ContactsPage() {
  const t = await getTranslations();
  const isAdmin = await isCurrentUserAdmin();
  const supabase = await createClient();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.title")} subtitle={t("contacts.subtitle")}>
        {isAdmin ? (
          <ButtonLink href="/app/contacts/new">
            <Plus />
            {t("contacts.new")}
          </ButtonLink>
        ) : null}
      </PageHeader>

      {!contacts?.length ? (
        <Empty>{t("contacts.none")}</Empty>
      ) : (
        <div className="glass-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.name")}</th>
                  <th>{t("fields.type")}</th>
                  <th>{t("fields.phone")}</th>
                  <th>{t("fields.city")}</th>
                  <th>{t("fields.email")}</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td>
                      <Link href={`/app/contacts/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </td>
                    <td>
                      <Badge variant="secondary">{t(`status.contact_type.${c.type}`)}</Badge>
                    </td>
                    <td className="text-muted-foreground">{c.phone ?? "—"}</td>
                    <td className="text-muted-foreground">{c.city ?? "—"}</td>
                    <td className="text-muted-foreground">{c.email ?? "—"}</td>
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
