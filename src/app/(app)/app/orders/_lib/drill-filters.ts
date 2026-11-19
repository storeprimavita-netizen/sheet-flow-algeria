import { UUID_RE } from "@/lib/query-string";
import { DELIVERY_TYPES } from "@/lib/enums";

export type DrillFilters = { category: string; confAgent: string; deliveryType: string };
export type DrillKey = "category" | "conf_agent" | "delivery_type";

/** The three statistics-only params of orders/all, checked once. A failing value is "" (applied nowhere). */
export function parseDrillFilters(get: (k: string) => string): { filters: DrillFilters; dropped: DrillKey[] } {
  const uuid = (k: string) => (UUID_RE.test(get(k).toLowerCase()) ? get(k).toLowerCase() : "");
  const dt = get("delivery_type");
  const filters: DrillFilters = {
    category: uuid("category"),
    confAgent: uuid("conf_agent"),
    deliveryType: (DELIVERY_TYPES as readonly string[]).includes(dt) ? dt : "",
  };
  const dropped: DrillKey[] = [];
  if (get("category") && !filters.category) dropped.push("category");
  if (get("conf_agent") && !filters.confAgent) dropped.push("conf_agent");
  if (dt && !filters.deliveryType) dropped.push("delivery_type");
  return { filters, dropped };
}

type Labels = {
  category: string;
  agent: string;
  deliveryType: string;
  selected: string;
  deliveryTypeNames: Record<string, string>;
  categories: { value: string; label: string }[];
  agents: { value: string; label: string }[];
};

/** Chips for the checked filters: "<field>: <label>", or "<field>: Selected" when no label is found. */
export function drillChips(f: DrillFilters, l: Labels): { key: DrillKey; label: string }[] {
  const out: { key: DrillKey; label: string }[] = [];
  if (f.category)
    out.push({ key: "category", label: `${l.category}: ${l.categories.find((o) => o.value === f.category)?.label ?? l.selected}` });
  if (f.confAgent)
    out.push({ key: "conf_agent", label: `${l.agent}: ${l.agents.find((o) => o.value === f.confAgent)?.label ?? l.selected}` });
  if (f.deliveryType)
    out.push({ key: "delivery_type", label: `${l.deliveryType}: ${l.deliveryTypeNames[f.deliveryType] ?? l.selected}` });
  return out;
}
