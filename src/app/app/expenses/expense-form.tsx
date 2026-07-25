"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import type { Enums, Tables, TablesInsert } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";
import { EXPENSE_CATEGORIES } from "@/lib/enums";

type ExpenseRow = Tables<"expenses">;
type ProductOpt = { id: string; name: string };
type OrderOpt = { id: string; order_number: string | null };

export function ExpenseForm({ expense }: { expense?: ExpenseRow }) {
  const router = useRouter();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [orders, setOrders] = useState<OrderOpt[]>([]);
  const editing = Boolean(expense?.id);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("products").select("id, name").order("name"),
      supabase.from("orders").select("id, order_number").order("created_at", { ascending: false }),
    ]).then(([p, o]) => {
      setProducts((p.data as ProductOpt[] | null) ?? []);
      setOrders((o.data as OrderOpt[] | null) ?? []);
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const opt = (n: string) => String(fd.get(n) ?? "").trim() || null;
    const amount = Number(fd.get("amount") ?? 0);

    const payload: TablesInsert<"expenses"> = {
      category: String(fd.get("category") ?? "other") as Enums<"expense_category">,
      amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
      incurred_on: String(fd.get("incurred_on") ?? "").trim() || new Date().toISOString().slice(0, 10),
      product_id: opt("product_id"),
      order_id: opt("order_id"),
      notes: opt("notes"),
    };

    const supabase = createClient();
    const { error } = editing
      ? await supabase.from("expenses").update(payload).eq("id", expense!.id)
      : await supabase.from("expenses").insert(payload);

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/app/expenses");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="glass-card space-y-4 rounded-xl p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.amount")} htmlFor="amount">
            <Input
              id="amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              required
              defaultValue={expense?.amount ?? ""}
            />
          </Field>
          <Field label={t("fields.incurred_on")} htmlFor="incurred_on">
            <Input
              id="incurred_on"
              name="incurred_on"
              type="date"
              required
              defaultValue={expense?.incurred_on ?? new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label={t("fields.category")} htmlFor="category">
            <Select id="category" name="category" defaultValue={expense?.category ?? "other"}>
              {EXPENSE_CATEGORIES.map((s) => (
                <option key={s} value={s}>
                  {t(`status.expense_category.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.product")} htmlFor="product_id" hint={t("common.optional")}>
            <Select id="product_id" name="product_id" defaultValue={expense?.product_id ?? ""}>
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.order")} htmlFor="order_id" hint={t("common.optional")}>
            <Select id="order_id" name="order_id" defaultValue={expense?.order_id ?? ""}>
              <option value="">—</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.order_number ?? o.id.slice(0, 8)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label={t("fields.notes")} htmlFor="notes" hint={t("common.optional")}>
          <Textarea id="notes" name="notes" defaultValue={expense?.notes ?? ""} />
        </Field>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/15 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={busy}>
          {busy ? t("actions.saving") : t("actions.save")}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={busy}>
          {t("actions.cancel")}
        </Button>
      </div>
    </form>
  );
}
