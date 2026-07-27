import { getTranslations } from "next-intl/server";

import { AD_KINDS } from "@/lib/enums";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/native-select";
import { Button } from "@/components/ui/button";
import { CurrencyRateFields } from "@/components/currency-rate-fields";
import { upsertAdSpend } from "@/app/app/products/actions";

/** Quick daily ad-spend entry. Fixed to one product on the product page; a
 * product picker shows up when reused without `productId` (Dashboard, Ph.7). */
export async function AdSpendEntry({
  productId,
  products,
  rates,
}: {
  productId?: string;
  products?: { id: string; name: string }[];
  rates: { USD: number; EUR: number };
}) {
  const t = await getTranslations();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={upsertAdSpend} className="card-surface space-y-4 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("products.adSpend")}</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {productId ? (
          <input type="hidden" name="product_id" value={productId} />
        ) : (
          <Field label={t("fields.product")} htmlFor="product_id">
            <Select id="product_id" name="product_id" required>
              {(products ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label={t("fields.incurred_on")} htmlFor="spent_on">
          <Input id="spent_on" name="spent_on" type="date" required defaultValue={today} />
        </Field>
        <Field label={t("fields.kind")} htmlFor="kind">
          <Select id="kind" name="kind" defaultValue="test">
            {AD_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`status.ad_kind.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("fields.amount")} htmlFor="amount">
          <Input id="amount" name="amount" type="number" min="0" step="0.01" required />
        </Field>
        <CurrencyRateFields defaultCurrency="EUR" defaultRate={rates.EUR} rates={rates} />
      </div>
      <Button type="submit" size="sm">
        {t("actions.save")}
      </Button>
    </form>
  );
}
