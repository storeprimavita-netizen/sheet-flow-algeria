import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { ButtonLink } from "@/components/button-link";
import { Empty } from "@/components/empty";
import { tableClass } from "@/components/field";

export default async function ExpensesPage() {
  const t = await getTranslations();
  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from("expenses")
    .select("*, product:products(name), order:orders(order_number)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader title={t("expenses.title")} subtitle={t("expenses.subtitle")}>
        <ButtonLink href="/app/expenses/new">
          <Plus />
          {t("expenses.new")}
        </ButtonLink>
      </PageHeader>

      {!expenses?.length ? (
        <Empty>{t("expenses.none")}</Empty>
      ) : (
        <div className="glass-card overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th>{t("fields.incurred_on")}</th>
                  <th>{t("fields.category")}</th>
                  <th>{t("fields.amount")}</th>
                  <th>{t("fields.product")}</th>
                  <th>{t("fields.order")}</th>
                  <th>{t("fields.notes")}</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td>
                      <Link href={`/app/expenses/${e.id}`} className="font-medium hover:underline">
                        {formatDate(e.incurred_on)}
                      </Link>
                    </td>
                    <td>
                      <Badge variant="secondary">{t(`status.expense_category.${e.category}`)}</Badge>
                    </td>
                    <td>{formatCurrency(e.amount)}</td>
                    <td className="text-muted-foreground">{e.product?.name ?? "—"}</td>
                    <td className="text-muted-foreground">
                      {e.order?.order_number ?? "—"}
                    </td>
                    <td className="max-w-[20ch] truncate text-muted-foreground" title={e.notes ?? ""}>
                      {e.notes ?? "—"}
                    </td>
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
