import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { lastPage, pageHref, parsePage, readPage } from "@/lib/list-pagination";
import { ButtonLink } from "@/components/button-link";
import { formatCurrency, formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, tableClass } from "@/components/field";
import { Empty } from "@/components/empty";
import { recordCashCollection, markDeposited } from "../actions";
import { OrderNo } from "@/components/order-no";

const PATH = "/app/money/courier-cash";
type Params = Record<string, string | undefined>;
type PageKey = "uncollectedPage" | "outstandingPage" | "depositsPage";

export async function CollectionsTab({ searchParams }: { searchParams: Params }) {
  const t = await getTranslations();
  const supabase = await createClient();

  const pages: Record<PageKey, number> = {
    uncollectedPage: parsePage(searchParams.uncollectedPage),
    outstandingPage: parsePage(searchParams.outstandingPage),
    depositsPage: parsePage(searchParams.depositsPage),
  };
  const collections = (status: "collected" | "deposited", page: number) =>
    readPage(page, (start, end) =>
      supabase
        .from("cash_collections")
        .select("*, order:orders(order_seq, customer_name)", { count: "exact" })
        .eq("status", status)
        .order("created_at", { ascending: false })
        .order("id")
        .range(start, end),
    );

  const [uncollected, outstanding, deposits] = await Promise.all([
    // Anti-join in the database: delivered orders with no collection, before paging.
    readPage(pages.uncollectedPage, (start, end) =>
      supabase
        .from("orders")
        .select("id, order_seq, sale_price, quantity, customer_name, cash:cash_collections(id)", { count: "exact" })
        .eq("delivery_status", "delivered")
        .is("cash", null)
        .order("created_at", { ascending: false })
        .order("id")
        .range(start, end),
    ),
    collections("collected", pages.outstandingPage),
    collections("deposited", pages.depositsPage),
  ]);
  const lists = { uncollectedPage: uncollected, outstandingPage: outstanding, depositsPage: deposits };
  for (const key of Object.keys(lists) as PageKey[]) {
    const { goTo } = lists[key];
    if (goTo) redirect(pageHref(PATH, searchParams, key, goTo));
  }

  const pager = (key: PageKey) => {
    const page = pages[key];
    const last = lastPage(lists[key].total);
    if (last <= 1) return null;
    return (
      <nav aria-labelledby={`${key}-title`} className="flex items-center justify-between gap-2 text-sm">
        <span className="num text-muted-foreground">{t("table.page")} {page} / {last}</span>
        <div className="flex gap-2">
          {page > 1 ? <ButtonLink href={`${pageHref(PATH, searchParams, key, page - 1)}#${key}-title`} variant="outline" size="sm">{t("common.prev")}</ButtonLink> : null}
          {page < last ? <ButtonLink href={`${pageHref(PATH, searchParams, key, page + 1)}#${key}-title`} variant="outline" size="sm">{t("common.next")}</ButtonLink> : null}
        </div>
      </nav>
    );
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 id="uncollectedPage-title" className="scroll-mt-20 text-sm font-semibold">{t("cash.record")}</h2>
        <p className="text-xs text-muted-foreground">{t("cash.recordHint")}</p>
        {!uncollected.rows.length ? (
          <Empty>{t("cash.noUncollected")}</Empty>
        ) : (
          <div className="space-y-2">
            {uncollected.rows.map((o) => {
              const total = (o.sale_price ?? 0) * o.quantity;
              return (
                <form
                  key={o.id}
                  action={recordCashCollection.bind(null, o.id)}
                  className="card-surface flex flex-wrap items-end gap-3 rounded-xl p-3"
                >
                  <div className="min-w-[12rem] flex-1">
                    <div className="font-medium"><OrderNo seq={o.order_seq} /></div>
                    <div className="text-xs text-muted-foreground">
                      {o.customer_name ?? "—"} · {t("fields.total_amount")}: {formatCurrency(total)}
                    </div>
                  </div>
                  <Field label={t("cash.amount")} htmlFor={`amt_${o.id}`}>
                    <Input
                      id={`amt_${o.id}`}
                      name="amount_dzd"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={total}
                      className="w-32"
                    />
                  </Field>
                  <Button type="submit" size="sm">
                    {t("cash.save")}
                  </Button>
                </form>
              );
            })}
          </div>
        )}
        {pager("uncollectedPage")}
      </section>

      <section className="space-y-3">
        <h2 id="outstandingPage-title" className="scroll-mt-20 text-sm font-semibold">{t("cash.outstanding")}</h2>
        {!outstanding.rows.length ? (
          <Empty>{t("cash.noOutstanding")}</Empty>
        ) : (
          <div className="space-y-2">
            {outstanding.rows.map((c) => (
              <form
                key={c.id}
                action={markDeposited.bind(null, c.id)}
                className="card-surface flex flex-wrap items-end gap-3 rounded-xl p-3"
              >
                <div className="min-w-[12rem] flex-1">
                  <div className="font-medium"><OrderNo seq={c.order?.order_seq} /></div>
                  <div className="text-xs text-muted-foreground">
                    {c.order?.customer_name ?? "—"} · {formatCurrency(c.amount_dzd)} · {formatDate(c.collected_on)}
                  </div>
                </div>
                <Field label={t("cash.depositReference")} htmlFor={`ref_${c.id}`}>
                  <Input id={`ref_${c.id}`} name="reference" className="w-40" />
                </Field>
                <Button type="submit" size="sm">
                  {t("cash.createDeposit")}
                </Button>
              </form>
            ))}
          </div>
        )}
        {pager("outstandingPage")}
      </section>

      <section className="space-y-3">
        <h2 id="depositsPage-title" className="scroll-mt-20 text-sm font-semibold">{t("cash.deposits")}</h2>
        {!deposits.rows.length ? (
          <Empty>{t("cash.noDeposits")}</Empty>
        ) : (
          <div className="card-surface overflow-hidden rounded-xl">
            <div className="overflow-x-auto">
              <table className={tableClass}>
                <thead>
                  <tr>
                    <th>{t("cash.order")}</th>
                    <th>{t("cash.depositReference")}</th>
                    <th>{t("cash.amount")}</th>
                    <th>{t("fields.placed_at")}</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.rows.map((d) => (
                    <tr key={d.id}>
                      <td className="font-medium"><OrderNo seq={d.order?.order_seq} /></td>
                      <td>
                        {d.reference ? <Badge variant="secondary">{d.reference}</Badge> : "—"}
                      </td>
                      <td>{formatCurrency(d.amount_dzd)}</td>
                      <td className="text-muted-foreground">{formatDate(d.deposited_on)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {pager("depositsPage")}
      </section>
    </div>
  );
}
