import { getTranslations } from "next-intl/server";

import { requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "../order-form";

export default async function NewOrderPage() {
  await requireAdmin("/app/orders");
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.new")} />
      <OrderForm />
    </div>
  );
}
