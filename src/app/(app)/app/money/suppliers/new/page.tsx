import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/page-header";
import { ContactForm } from "@/app/(app)/app/sell/customers/contact-form";

export default async function NewSupplierPage() {
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("contacts.newSupplier")} subtitle={t("navSubtitle.supplierNew")} />
      <ContactForm />
    </div>
  );
}
