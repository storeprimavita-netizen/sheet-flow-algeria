"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Ban } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { MoneyField } from "@/components/fields/money-field";
import { tableClass } from "@/components/field";
import { cn } from "@/lib/utils";
import { useSubmitAction } from "@/lib/use-submit-action";
import { saveWilayaFees, type FeesSaveState } from "./actions";
import { FeesCsvDialog } from "./fees-csv-dialog";

type FeeRow = {
  wilaya_code: number;
  home_fee: number;
  stopdesk_fee: number;
  stop_shipping: boolean;
  priced: boolean;
  stopdesk_available: boolean;
  wilaya: { name: string } | null;
};

export function FeesSection({
  rows,
  autoFlagged,
  snapshot,
}: {
  rows: FeeRow[];
  autoFlagged: Set<number>;
  /** max(updated_at) when the grid loaded; the save refuses if it moved */
  snapshot: string;
}) {
  const t = useTranslations();
  // re-key rows after a CSV apply so uncontrolled inputs pick up new defaults
  const gridKey = snapshot + rows.length;
  const [state, formAction] = React.useActionState<FeesSaveState, FormData>((_prev, fd) => saveWilayaFees(fd), undefined);
  const onSubmit = useSubmitAction(formAction);
  const nameOf = (code: number) => rows.find((r) => r.wilaya_code === code)?.wilaya?.name ?? String(code);

  return (
    <section id="delivery-fees" className="card-surface scroll-mt-20 space-y-4 rounded-xl p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t("settings.deliveryFees")}</h2>
        <FeesCsvDialog />
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>{t("settings.fees.purpose")}</p>
        <p>
          <bdi>{t("settings.deliveryCsv.formatHint")}</bdi>
        </p>
      </div>

      <form method="post" key={gridKey} onSubmit={onSubmit} className="space-y-4">
        <input type="hidden" name="snapshot" value={snapshot} />
        <div className="md:max-h-[28rem] md:overflow-auto">
          <table className={cn(tableClass, "max-md:block [&_tbody]:max-md:block [&_tr]:max-md:block")}>
            <thead className="max-md:sr-only">
              <tr>
                <th>{t("fields.name")}</th>
                <th>{t("settings.fees.colPriced")}</th>
                <th>{t("settings.homeFee")}</th>
                <th>{t("settings.fees.colDesk")}</th>
                <th>{t("settings.stopdeskFee")}</th>
                <th>{t("settings.stopShipping")}</th>
                <th>{t("dashboard.wilaya.stopShippingAuto")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <FeeGridRow key={r.wilaya_code} row={r} auto={autoFlagged.has(r.wilaya_code)} />
              ))}
            </tbody>
          </table>
        </div>
        {state?.error ? (
          <p role="alert" className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">
            {t(`settings.fees.${state.error}`, { names: (state.codes ?? []).map(nameOf).join(", ") })}
          </p>
        ) : null}
        <Button type="submit">{t("actions.save")}</Button>
      </form>
    </section>
  );
}

function FeeGridRow({ row: r, auto }: { row: FeeRow; auto: boolean }) {
  const t = useTranslations();
  const [priced, setPriced] = React.useState(r.priced);
  const [desk, setDesk] = React.useState(r.stopdesk_available);
  const [stop, setStop] = React.useState(r.stop_shipping);
  const name = r.wilaya?.name ?? String(r.wilaya_code);
  const cell = "max-md:flex max-md:items-center max-md:justify-between max-md:gap-3";
  return (
    <tr className="max-md:mb-3 max-md:rounded-lg max-md:border max-md:border-border max-md:p-2">
      <td className={cn(cell, "font-medium")}>
        <bdi>{name}</bdi>
        {!priced ? <Badge variant="outline">{t("settings.fees.noPrice")}</Badge> : null}
      </td>
      <td className={cell}>
        <span className="md:hidden">{t("settings.fees.colPriced")}</span>
        <Switch
          name={`priced_${r.wilaya_code}`}
          checked={priced}
          onCheckedChange={setPriced}
          aria-label={t("settings.fees.pricedFor", { name })}
        />
      </td>
      <td className={cell}>
        <span className="md:hidden">{t("settings.homeFee")}</span>
        {priced ? (
          <MoneyField name={`home_${r.wilaya_code}`} ariaLabel={`${t("settings.homeFee")}: ${name}`} defaultValue={r.home_fee} className="w-32" />
        ) : (
          <span className="text-xs text-muted-foreground" title={t("settings.fees.noPriceHint")}>
            {t("settings.fees.noPrice")}
          </span>
        )}
      </td>
      <td className={cell}>
        <span className="md:hidden">{t("settings.fees.colDesk")}</span>
        <Switch
          name={`desk_${r.wilaya_code}`}
          checked={desk}
          onCheckedChange={setDesk}
          disabled={!priced}
          aria-label={t("settings.fees.deskFor", { name })}
        />
      </td>
      <td className={cell}>
        <span className="md:hidden">{t("settings.stopdeskFee")}</span>
        {priced && desk ? (
          <MoneyField name={`stopdesk_${r.wilaya_code}`} ariaLabel={`${t("settings.stopdeskFee")}: ${name}`} defaultValue={r.stopdesk_fee} className="w-32" />
        ) : (
          <span className="text-xs text-muted-foreground">{priced ? t("settings.fees.homeOnly") : t("settings.fees.noPrice")}</span>
        )}
      </td>
      <td className={cell}>
        <span className="md:hidden">{t("settings.stopShipping")}</span>
        <Switch name={`stop_${r.wilaya_code}`} checked={stop} onCheckedChange={setStop} aria-label={t("settings.fees.stopFor", { name })} />
      </td>
      <td className={cell}>
        <span className="md:hidden">{t("dashboard.wilaya.stopShippingAuto")}</span>
        {auto ? (
          <Badge variant="destructive" className="gap-1">
            <Ban className="h-3 w-3" aria-hidden />
            {t("settings.fees.autoStop")}
          </Badge>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}
