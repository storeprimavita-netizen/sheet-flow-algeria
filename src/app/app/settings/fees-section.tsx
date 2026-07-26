import { getTranslations } from "next-intl/server";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { tableClass } from "@/components/field";
import { saveWilayaFees } from "./actions";

type FeeRow = {
  wilaya_code: number;
  home_fee: number;
  stopdesk_fee: number;
  stop_shipping: boolean;
  wilaya: { name: string } | null;
};

export async function FeesSection({
  rows,
  autoFlagged,
}: {
  rows: FeeRow[];
  autoFlagged: Set<number>;
}) {
  const t = await getTranslations();

  return (
    <section className="glass-card space-y-4 rounded-xl p-5">
      <h2 className="text-sm font-semibold">{t("settings.deliveryFees")}</h2>
      <form action={saveWilayaFees} className="space-y-4">
        <div className="max-h-[28rem] overflow-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th>{t("fields.name")}</th>
                <th>{t("settings.homeFee")}</th>
                <th>{t("settings.stopdeskFee")}</th>
                <th>{t("settings.stopShipping")}</th>
                <th>{t("dashboard.wilaya.stopShippingAuto")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.wilaya_code}>
                  <td>{r.wilaya?.name ?? r.wilaya_code}</td>
                  <td>
                    <Input
                      name={`home_${r.wilaya_code}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={r.home_fee}
                      className="h-8 w-28"
                    />
                  </td>
                  <td>
                    <Input
                      name={`stopdesk_${r.wilaya_code}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={r.stopdesk_fee}
                      className="h-8 w-28"
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      name={`stop_${r.wilaya_code}`}
                      defaultChecked={r.stop_shipping}
                      className="h-4 w-4"
                    />
                  </td>
                  <td>{autoFlagged.has(r.wilaya_code) ? <Badge variant="destructive">🚫</Badge> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button type="submit">{t("actions.save")}</Button>
      </form>
    </section>
  );
}
