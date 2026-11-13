"use client";

import * as React from "react";
import {
  Camera,
  Box,
  FlaskRound,
  PhoneCall,
  Truck,
  FlaskConical,
  TrendingUp,
  Ellipsis,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { EXPENSE_CATEGORIES } from "@/lib/enums";
import { EXPENSE_CATEGORY_TOKEN, type IconType } from "@/lib/statuses";
import { ColorDot } from "@/components/ui/chip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export const CATEGORY_ICONS: Record<(typeof EXPENSE_CATEGORIES)[number], IconType> = {
  shooting: Camera,
  packaging: Box,
  sampling: FlaskRound,
  confirmation: PhoneCall,
  delivery: Truck,
  test_ads: FlaskConical,
  scaling_ads: TrendingUp,
  other: Ellipsis,
};

/** Expense category select: icon + label per option. */
export function CategorySelect({
  name,
  value,
  defaultValue,
  onChange,
  disabled,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  return (
    <Select name={name} value={value} defaultValue={defaultValue} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={t("fields.category")} />
      </SelectTrigger>
      <SelectContent>
        {EXPENSE_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c];
          return (
            <SelectItem key={c} value={c}>
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {t(`status.expense_category.${c}`)}
                <ColorDot token={EXPENSE_CATEGORY_TOKEN[c]} className="ms-auto" />
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
