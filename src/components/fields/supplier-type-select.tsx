"use client";

import * as React from "react";
import { Camera, Scissors, Package, Ellipsis } from "lucide-react";
import { useTranslations } from "next-intl";

import { SUPPLIER_TYPES } from "@/lib/enums";
import { SUPPLIER_TYPE_TOKEN, type IconType } from "@/lib/statuses";
import { ColorDot } from "@/components/ui/chip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export const SUPPLIER_TYPE_ICONS: Record<(typeof SUPPLIER_TYPES)[number], IconType> = {
  shooting_studio: Camera,
  atelier_couture: Scissors,
  emballage: Package,
  other: Ellipsis,
};

/** Supplier type select: icon + label per option (studio/atelier/emballage/other). */
export function SupplierTypeSelect({
  name,
  defaultValue,
  disabled,
}: {
  name?: string;
  defaultValue?: string;
  disabled?: boolean;
}) {
  const t = useTranslations();
  return (
    <Select name={name} defaultValue={defaultValue} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={t("fields.type")} />
      </SelectTrigger>
      <SelectContent>
        {SUPPLIER_TYPES.map((s) => {
          const Icon = SUPPLIER_TYPE_ICONS[s];
          return (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {t(`status.supplier_type.${s}`)}
                <ColorDot token={SUPPLIER_TYPE_TOKEN[s]} className="ms-auto" />
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
