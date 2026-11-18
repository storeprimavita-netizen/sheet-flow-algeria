import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { ContactForm } from "../../contact-form";

export default async function NewSupplierPage() {
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.newSupplier")} />
      <ContactForm />
    </div>
  );
}
