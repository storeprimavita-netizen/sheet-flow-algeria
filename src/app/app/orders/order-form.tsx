"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import type { TablesInsert } from "@/lib/supabase/database.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/field";

type ProductOpt = { id: string; name: string; sku: string | null };
type CustomerOpt = { id: string; name: string };

export function OrderForm() {
  const router = useRouter();
  const t = useTranslations();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductOpt[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase.from("products").select("id, name, sku").eq("is_active", true).order("name"),
      supabase.from("contacts").select("id, name").eq("type", "customer").order("name"),
    ]).then(([p, c]) => {
      setProducts((p.data as ProductOpt[] | null) ?? []);
      setCustomers((c.data as CustomerOpt[] | null) ?? []);
    });
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const opt = (n: string) => String(fd.get(n) ?? "").trim() || null;
    const up = Number(fd.get("unit_price") ?? "");

    const payload: TablesInsert<"orders"> = {
      product_id: opt("product_id"),
      customer_id: opt("customer_id"),
      quantity: Math.max(1, Number(fd.get("quantity") ?? 1) || 1),
      unit_price: Number.isFinite(up) && up > 0 ? up : null,
      city: opt("city"),
      address: opt("address"),
      source: "manual",
      placed_at: new Date().toISOString(),
    };

    const supabase = createClient();
    const { error } = await supabase.from("orders").insert(payload);

    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/app/orders");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="glass-card space-y-4 rounded-xl p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.product")} htmlFor="product_id" hint={t("common.optional")}>
            <Select id="product_id" name="product_id" defaultValue="">
              <option value="">—</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.sku ? ` (${p.sku})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.customer")} htmlFor="customer_id" hint={t("common.optional")}>
            <Select id="customer_id" name="customer_id" defaultValue="">
              <option value="">—</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.quantity")} htmlFor="quantity">
            <Input id="quantity" name="quantity" type="number" min="1" step="1" defaultValue="1" />
          </Field>
          <Field label={t("fields.unit_price")} htmlFor="unit_price" hint={t("common.optional")}>
            <Input id="unit_price" name="unit_price" type="number" min="0" step="0.01" />
          </Field>
          <Field label={t("fields.city")} htmlFor="city" hint={t("common.optional")}>
            <Input id="city" name="city" />
          </Field>
          <Field label={t("fields.address")} htmlFor="address" hint={t("common.optional")}>
            <Input id="address" name="address" />
          </Field>
        </div>
        <Field label={t("fields.agent_comment")} htmlFor="agent_comment" hint={t("common.optional")}>
          <Textarea id="agent_comment" name="agent_comment" />
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
