import { z } from "zod";

import { CONFIRMATION_STATUSES, DELIVERY_STATUSES, ORDER_SOURCES } from "@/lib/enums";
import { sanitizeOrderTextQuery } from "@/lib/order-search";

/** URL marker that clears a filter the active view would otherwise apply. */
export const CLEARED = "__all";

/** Columns the orders tables can sort by -> real order-able DB columns. Shared allow-list. */
export const SORT_COLUMNS: Record<string, string> = {
  order_seq: "order_seq",
  placed_at: "placed_at",
};

export const VIEW_SCOPES = ["confirmation", "shipping", "all"] as const;
export type ViewScope = (typeof VIEW_SCOPES)[number];
export const MAX_VIEWS_PER_GROUP = 20;
/** CONF-4: Confirmation-only queue slices. */
export const QUEUE_SLICES = ["callbacks_due", "confirmed_today"] as const;
export const VIEW_LAYOUTS = ["table", "kanban"] as const;
export const KANBAN_GROUPS = ["status", "attempts", "wilaya", "product"] as const;
export const KANBAN_FIELDS = ["product", "wilaya", "total", "attempts", "age", "score"] as const;
export type ViewLayout = (typeof VIEW_LAYOUTS)[number];
export type KanbanGroup = (typeof KANBAN_GROUPS)[number];
export type KanbanField = (typeof KANBAN_FIELDS)[number];
export type ViewPresentation = { layout: ViewLayout; groupBy: KanbanGroup; cardFields: KanbanField[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s: string) => ISO_DATE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Every filter value, typed. One schema per key so a bad value drops only that key. */
const keySchemas = {
  confirmation_status: z.array(z.enum(CONFIRMATION_STATUSES)).min(1).max(CONFIRMATION_STATUSES.length),
  delivery_status: z.enum(DELIVERY_STATUSES),
  product_id: z.string().regex(UUID),
  wilaya_code: z.number().int().min(1).max(58),
  source: z.enum(ORDER_SOURCES),
  agent: z.string().regex(UUID),
  duplicates: z.literal("1"),
  q: z.string().transform((s) => s.trim().slice(0, 80)).pipe(z.string().min(1)),
  from: z.string().refine(isRealDate),
  to: z.string().refine(isRealDate),
  sort: z.enum(Object.keys(SORT_COLUMNS) as [string, ...string[]]),
  dir: z.enum(["asc", "desc"]),
  queue_slice: z.enum(QUEUE_SLICES),
} as const;

export const FILTER_KEYS = Object.keys(keySchemas) as (keyof typeof keySchemas)[];
export type FilterKey = (typeof FILTER_KEYS)[number];

export const viewConfigSchema = z.object({
  ...keySchemas,
  columns: z.array(z.string().max(40)).max(40),
  groupBy: z.enum(KANBAN_GROUPS),
  cardFields: z.array(z.enum(KANBAN_FIELDS)).max(KANBAN_FIELDS.length),
}).partial();
export type ViewConfig = z.infer<typeof viewConfigSchema>;

type Raw = Record<string, unknown>;

/** Lenient parse of a stored config: unknown or invalid keys are dropped, valid ones kept. */
export function parseViewConfig(raw: unknown): ViewConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Raw = {};
  for (const k of FILTER_KEYS) {
    const v = (raw as Raw)[k];
    if (v === undefined) continue;
    const r = keySchemas[k].safeParse(v);
    if (r.success) out[k] = r.data;
  }
  for (const key of ["columns", "groupBy", "cardFields"] as const) {
    const result = viewConfigSchema.shape[key].safeParse((raw as Raw)[key]);
    if (result.success && result.data !== undefined) out[key] = result.data;
  }
  return out as ViewConfig;
}

export type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export function availableKanbanFields(scope: ViewScope, isAdmin: boolean): readonly KanbanField[] {
  if (scope === "confirmation") return KANBAN_FIELDS;
  if (scope === "shipping") return isAdmin ? ["product", "wilaya", "total", "attempts", "age"] : ["product", "wilaya", "total", "age"];
  return isAdmin ? KANBAN_FIELDS : ["product", "wilaya", "attempts", "age", "score"];
}

export function availableKanbanGroups(scope: ViewScope, isAdmin: boolean): readonly KanbanGroup[] {
  return scope === "shipping" && !isAdmin ? ["status", "wilaya", "product"] : KANBAN_GROUPS;
}

export function viewPresentation(
  scope: ViewScope,
  isAdmin: boolean,
  view: Pick<OrderViewDto, "layout" | "config"> | null,
  sp: SearchParams = {},
): ViewPresentation {
  const layout = z.enum(VIEW_LAYOUTS).safeParse(first(sp.layout));
  const group = viewConfigSchema.shape.groupBy.safeParse(first(sp.groupBy));
  const urlFields = typeof sp.cardFields === "string" ? sp.cardFields.split(",").filter(Boolean) : undefined;
  const fields = viewConfigSchema.shape.cardFields.safeParse(urlFields);
  const allowed = availableKanbanFields(scope, isAdmin);
  const groupBy = group.data ?? view?.config.groupBy ?? "status";
  const defaults: KanbanField[] = scope === "confirmation" ? ["product", "attempts", "score"] : ["product", "wilaya", "total"];
  return {
    layout: layout.success ? layout.data : view?.layout ?? (scope === "shipping" && sp.view === "kanban" ? "kanban" : "table"),
    groupBy: availableKanbanGroups(scope, isAdmin).includes(groupBy) ? groupBy : "status",
    cardFields: [...new Set(fields.data ?? view?.config.cardFields ?? defaults)].filter((field) => allowed.includes(field)),
  };
}

export function presentationDirty(saved: ViewPresentation, current: ViewPresentation) {
  return saved.layout !== current.layout || saved.groupBy !== current.groupBy ||
    saved.cardFields.join(",") !== current.cardFields.join(",");
}

export function serializePresentation(params: URLSearchParams, { layout, groupBy, cardFields }: ViewPresentation) {
  params.set("layout", layout);
  params.set("groupBy", groupBy);
  params.set("cardFields", cardFields.join(","));
  return params;
}
/** URL string -> typed value (undefined when empty or invalid). */
function parseUrlValue(key: FilterKey, s: string): unknown {
  if (!s) return undefined;
  let raw: unknown = s;
  if (key === "confirmation_status") {
    // one bad value must not drop the whole filter
    const ok = new Set<string>(CONFIRMATION_STATUSES);
    raw = [...new Set(s.split(",").map((x) => x.trim()).filter((x) => ok.has(x)))];
  }
  if (key === "wilaya_code") raw = /^\d{1,2}$/.test(s) ? Number(s) : NaN;
  const r = keySchemas[key].safeParse(raw);
  return r.success ? r.data : undefined;
}

export function parseUrlConfig(sp: SearchParams): { values: ViewConfig; cleared: Set<FilterKey> } {
  const values: Raw = {};
  const cleared = new Set<FilterKey>();
  for (const k of FILTER_KEYS) {
    const s = first(sp[k]);
    if (s === CLEARED) cleared.add(k);
    else {
      const v = parseUrlValue(k, s);
      if (v !== undefined) values[k] = v;
    }
  }
  return { values: values as ViewConfig, cleared };
}

/** URL overrides the view; a cleared marker removes a view filter. */
export function effectiveConfig(view: ViewConfig | null, sp: SearchParams): ViewConfig {
  const { values, cleared } = parseUrlConfig(sp);
  const out: Raw = { ...(view ?? {}) };
  for (const k of cleared) delete out[k];
  Object.assign(out, values);
  return out as ViewConfig;
}

function urlString(key: FilterKey, v: unknown): string {
  return Array.isArray(v) ? v.join(",") : String(v);
}

/** Config -> URL params (filters + sort only; columns are stored, not in the URL). */
export function serializeConfig(config: ViewConfig): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of FILTER_KEYS) {
    const v = (config as Raw)[k];
    if (v !== undefined) p.set(k, urlString(k, v));
  }
  return p;
}

function normalized(config: ViewConfig): string {
  const o: Raw = {};
  for (const k of FILTER_KEYS) {
    const v = (config as Raw)[k];
    if (v === undefined) continue;
    o[k] = k === "confirmation_status" ? [...(v as string[])].sort() : v;
  }
  return JSON.stringify(o);
}

/** Dirty = the effective filters differ from the saved view; `page` and columns are ignored. */
export function isDirty(view: ViewConfig, sp: SearchParams): boolean {
  return normalized(effectiveConfig(view, sp)) !== normalized(view);
}

/** Valid `?view` id or null (junk is never sent to the database). */
export function parseViewId(v: string | string[] | undefined): string | null {
  const s = first(v);
  return UUID.test(s) ? s.toLowerCase() : null;
}

/** Text search pieces for the shared query builder: kept here so tests need no database. */
export function cleanQuery(q: string): string {
  return sanitizeOrderTextQuery(q.trim().slice(0, 80));
}

export type OrderViewDto = {
  id: string;
  name: string;
  emoji: string | null;
  scope: ViewScope;
  seed_key: string | null;
  shared: boolean;
  position: number;
  layout: ViewLayout;
  config: ViewConfig;
};

export const SEED_NAMES: Record<string, string> = { new: "New", no_answer: "No answer", duplicates: "Duplicates", kanban_by_status: "Kanban by status", callbacks_due: "Callbacks due", confirmed_today: "Today confirmed" };

/** Seeded views show a translated name until an admin renames them. */
export function isUnrenamedSeed(v: Pick<OrderViewDto, "seed_key" | "name">): boolean {
  return !!v.seed_key && SEED_NAMES[v.seed_key] === v.name;
}

export const viewInputSchema = z.object({
  name: z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(60)),
  emoji: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().max(16))
    .refine((s) => [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s)].length <= 1)
    .nullish()
    .transform((s) => s || null),
});
