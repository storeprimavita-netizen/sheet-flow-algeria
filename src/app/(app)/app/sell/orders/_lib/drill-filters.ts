import { DRILL_PARAMS, UUID_RE } from "@/lib/query-string";
import { DELIVERY_TYPES } from "@/lib/enums";

export type DrillFilters = { category: string; confAgent: string; deliveryType: string };
export type DrillKey = "category" | "conf_agent" | "delivery_type";

/** Statistics-only filters read by orders/all (with or without a drill metric). */
export const DRILL_FILTER_KEYS = ["category", "conf_agent", "delivery_type"] as const satisfies readonly DrillKey[];

/** Statistics drill mode = a drill metric (or its commune params) is in the URL. */
export const inDrillMode = (p: URLSearchParams) => DRILL_PARAMS.some((k) => p.has(k));

/** Any other filter change leaves drill mode: the drill params always go; the three key filters only
 * when `inDrill` (outside drill mode they are ordinary filters and stay). */
export function leaveDrillKeys(p: URLSearchParams, inDrill: boolean): URLSearchParams {
  for (const k of DRILL_PARAMS) p.delete(k);
  if (inDrill) for (const k of DRILL_FILTER_KEYS) p.delete(k);
  return p;
}

/** Removing one chip: exactly that key (and the page) goes, nothing else. */
export function dropOneKey(p: URLSearchParams, key: string): URLSearchParams {
  p.delete(key);
  p.delete("page");
  return p;
}

/** The three statistics-only params of orders/all, checked once. A failing value is "" (applied nowhere). */
export function parseDrillFilters(
  get: (k: string) => string,
  /** keys given more than once in the URL: ignored and reported as dropped */
  repeated: readonly string[] = [],
): { filters: DrillFilters; dropped: DrillKey[] } {
  const uuid = (k: string) => (UUID_RE.test(get(k).toLowerCase()) ? get(k).toLowerCase() : "");
  const dt = get("delivery_type");
  const filters: DrillFilters = {
    category: uuid("category"),
    confAgent: uuid("conf_agent"),
    deliveryType: (DELIVERY_TYPES as readonly string[]).includes(dt) ? dt : "",
  };
  const dropped: DrillKey[] = [];
  if ((get("category") || repeated.includes("category")) && !filters.category) dropped.push("category");
  if ((get("conf_agent") || repeated.includes("conf_agent")) && !filters.confAgent) dropped.push("conf_agent");
  if ((dt || repeated.includes("delivery_type")) && !filters.deliveryType) dropped.push("delivery_type");
  return { filters, dropped };
}

export type Labels = {
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

/** The message keys the bar hands to drillChips, resolved once (testable with a plain lookup). */
export function buildDrillLabels(
  t: (key: string) => string,
  categories: Labels["categories"],
  agents: Labels["agents"],
): Labels {
  return {
    category: t("fields.category"),
    agent: t("fields.agent"),
    deliveryType: t("statistics.filters.deliveryType"),
    selected: t("statistics.compare.selected"),
    deliveryTypeNames: { home: t("statistics.home"), stopdesk: t("statistics.stopdesk") },
    categories,
    agents,
  };
}
