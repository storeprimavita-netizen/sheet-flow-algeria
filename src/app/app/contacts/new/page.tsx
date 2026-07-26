import { getTranslations } from "next-intl/server";

import { getProfile, requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { ContactForm } from "../contact-form";

export default async function NewContactPage() {
  await requireAdmin("/app/contacts");
  const profile = (await getProfile())!;
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.new")} />
      <ContactForm workspaceId={profile.workspaceId} />
    </div>
  );
}
