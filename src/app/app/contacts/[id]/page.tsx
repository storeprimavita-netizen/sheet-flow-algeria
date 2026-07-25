import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { DeleteButton } from "@/components/delete-button";
import { ContactForm } from "../contact-form";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin("/app/contacts");
  const { id } = await params;
  const t = await getTranslations();

  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!contact) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.edit")} subtitle={contact.name}>
        <DeleteButton table="contacts" id={contact.id} redirectTo="/app/contacts" />
      </PageHeader>
      <ContactForm contact={contact} />
    </div>
  );
}
