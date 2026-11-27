import { getMessages } from "next-intl/server";

import { AdminGuardLayout } from "@/components/admin-guard-layout";
import { StatisticsMessagesProvider } from "@/i18n/statistics-messages-provider";

export default async function OrdersListLayout({ children }: { children: React.ReactNode }) {
  const guarded = await AdminGuardLayout({ children });
  const { statistics } = await getMessages();
  return <StatisticsMessagesProvider statistics={statistics}>{guarded}</StatisticsMessagesProvider>;
}
