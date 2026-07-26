import { getTranslations } from "next-intl/server";

import { getProfile, requireAdmin } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { OrderForm } from "../order-form";

export default async function NewOrderPage() {
  await requireAdmin("/app/orders");
  const profile = (await getProfile())!;
  const t = await getTranslations();

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.new")} />
      <OrderForm workspaceId={profile.workspaceId} />
    </div>
  );
}
