"use client";

import { useTranslations } from "next-intl";

import { TASK_PRIORITIES } from "@/lib/enums";
import { TASK_PRIORITY_TOKEN } from "@/lib/statuses";
import { ColorDot } from "@/components/ui/chip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

/** Task priority select: colored dot + label per option (fixed enum, not
 * a StatusKind — priority doesn't transition, it's just set). */
export function PrioritySelect({
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
        <SelectValue placeholder={t("fields.priority")} />
      </SelectTrigger>
      <SelectContent>
        {TASK_PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            <span className="flex items-center gap-2">
              <ColorDot token={TASK_PRIORITY_TOKEN[p]} />
              {t(`status.task_priority.${p}`)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
