"use client";

import { useId } from "react";
import { LayoutGrid, Settings2, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  availableKanbanFields, availableKanbanGroups, type ViewPresentation, type ViewScope,
} from "@/lib/order-views";

export function ViewPresentationControls({
  scope, isAdmin, presentation, onChange,
}: {
  scope: ViewScope;
  isAdmin: boolean;
  presentation: ViewPresentation;
  onChange: (next: ViewPresentation) => void;
}) {
  const t = useTranslations();
  const groupLabel = useId();
  const { layout, groupBy, cardFields } = presentation;
  const fields = availableKanbanFields(scope, isAdmin);

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <div role="group" aria-label={t("orderViews.layout")} className="inline-flex gap-1 rounded-md border border-border p-0.5">
        <Button type="button" variant={layout === "table" ? "secondary" : "ghost"} size="sm"
          className="min-h-10 gap-1.5 md:min-h-8" aria-pressed={layout === "table"}
          onClick={() => layout !== "table" && onChange({ ...presentation, layout: "table" })}>
          <Table2 aria-hidden className="size-4" />{t("orders.viewTable")}
        </Button>
        <Button type="button" variant={layout === "kanban" ? "secondary" : "ghost"} size="sm"
          className="min-h-10 gap-1.5 md:min-h-8" aria-pressed={layout === "kanban"}
          onClick={() => layout !== "kanban" && onChange({ ...presentation, layout: "kanban" })}>
          <LayoutGrid aria-hidden className="size-4" />{t("orders.viewKanban")}
        </Button>
      </div>
      {layout === "kanban" ? (
        <>
          <span id={groupLabel} className="sr-only">{t("orderViews.groupBy")}</span>
          <Select value={groupBy} onValueChange={(value) => {
            const group = availableKanbanGroups(scope, isAdmin).find((item) => item === value);
            if (group) onChange({ ...presentation, groupBy: group });
          }}>
            <SelectTrigger aria-labelledby={groupLabel} className="min-h-11 md:min-h-9">
              <SelectValue>{t(`orderViews.group.${groupBy}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {availableKanbanGroups(scope, isAdmin).map((group) => (
                <SelectItem key={group} value={group}>{t(`orderViews.group.${group}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="min-h-11 gap-1.5 md:min-h-9">
                <Settings2 aria-hidden className="size-4" />{t("orderViews.cardFields")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {fields.map((field) => (
                <DropdownMenuCheckboxItem key={field} checked={cardFields.includes(field)}
                  onCheckedChange={(checked) => onChange({
                    ...presentation, cardFields: checked ? [...cardFields, field] : cardFields.filter((item) => item !== field),
                  })}>
                  {t(`orderViews.card.${field}`)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}
    </div>
  );
}
