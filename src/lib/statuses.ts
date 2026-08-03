/**
 * Single source of truth for every status: label (i18n key), color token,
 * lucide icon, allowed transitions, terminal + confirm flags. Rendered only
 * through <StatusPill> / <StatusSelect> — never ad-hoc colored text.
 * Colors + icons mirror docs/design/DESIGN_SYSTEM.md §3.
 */
import {
  Clock,
  PhoneMissed,
  PhoneOff,
  XCircle,
  CheckCircle2,
  Package,
  Building2,
  Truck,
  Navigation,
  MapPin,
  CheckCheck,
  ClockAlert,
  CornerUpLeft,
  ArrowLeftRight,
  Undo2,
  FlaskConical,
  Repeat,
  Beaker,
  BadgeCheck,
  Ban,
  Circle,
  CircleDot,
  OctagonAlert,
  CircleCheck,
} from "lucide-react";

export type IconType = React.ComponentType<{ className?: string }>;

export type StatusToken =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "indigo"
  | "cyan"
  | "violet"
  | "orange"
  | "rose";

export type StatusKind = "confirmation" | "delivery" | "product" | "task";

/** Every chip color token — the fixed palette user-created options may pick from. */
export const CHIP_TOKENS: StatusToken[] = [
  "neutral",
  "success",
  "warning",
  "danger",
  "info",
  "indigo",
  "cyan",
  "violet",
  "orange",
  "rose",
];

/** Cycling palette for auto-colored user-created options (excludes neutral/danger — reserved meanings). */
export const OPTION_PALETTE: StatusToken[] = ["info", "success", "warning", "violet", "cyan", "orange", "indigo", "rose"];

/** Deterministic auto color for a user-created option (same input ⇒ same color, no DB round trip needed to preview it). */
export function autoToken(seed: string): StatusToken {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return OPTION_PALETTE[h % OPTION_PALETTE.length];
}

export type StatusDef = {
  key: string;
  /** i18n message key */
  label: string;
  token: StatusToken;
  icon: IconType;
  /** legal next states (only these are offered in the UI) */
  next: string[];
  terminal: boolean;
  /** show a confirm dialog naming the record before applying */
  requiresConfirm: boolean;
};

function def(
  kind: string,
  key: string,
  token: StatusToken,
  icon: IconType,
  next: string[],
  opts: { terminal?: boolean; requiresConfirm?: boolean } = {},
): StatusDef {
  const group =
    kind === "confirmation"
      ? "confirmation_status"
      : kind === "delivery"
        ? "delivery_status"
        : kind === "product"
          ? "product_status"
          : "task_status";
  return {
    key,
    label: `status.${group}.${key}`,
    token,
    icon,
    next,
    terminal: opts.terminal ?? false,
    requiresConfirm: opts.requiresConfirm ?? false,
  };
}

export const CONFIRMATION_STATUS: Record<string, StatusDef> = {
  wait_for_confirmation: def("confirmation", "wait_for_confirmation", "neutral", Clock, [
    "no_answer",
    "closed_phone",
    "cancelled",
    "confirmed",
  ]),
  no_answer: def("confirmation", "no_answer", "warning", PhoneMissed, [
    "closed_phone",
    "cancelled",
    "confirmed",
    "wait_for_confirmation",
  ]),
  closed_phone: def("confirmation", "closed_phone", "orange", PhoneOff, [
    "no_answer",
    "cancelled",
    "confirmed",
    "wait_for_confirmation",
  ]),
  cancelled: def("confirmation", "cancelled", "danger", XCircle, [], {
    terminal: true,
    requiresConfirm: true,
  }),
  confirmed: def("confirmation", "confirmed", "success", CheckCircle2, [], { terminal: true }),
};

export const DELIVERY_STATUS: Record<string, StatusDef> = {
  wait_for_deposit: def("delivery", "wait_for_deposit", "neutral", Package, ["bureau_deposited", "cancelled"]),
  bureau_deposited: def("delivery", "bureau_deposited", "info", Building2, ["in_transit", "delayed", "cancelled"]),
  in_transit: def("delivery", "in_transit", "indigo", Truck, ["out_for_delivery", "delayed", "returning"]),
  out_for_delivery: def("delivery", "out_for_delivery", "cyan", Navigation, [
    "delivered",
    "stop_desk_waiting",
    "delayed",
    "returning",
  ]),
  stop_desk_waiting: def("delivery", "stop_desk_waiting", "violet", MapPin, ["delivered", "delayed", "returning"]),
  delivered: def("delivery", "delivered", "success", CheckCheck, [], { terminal: true }),
  delayed: def("delivery", "delayed", "warning", ClockAlert, ["in_transit", "out_for_delivery", "delivered", "returning"]),
  cancelled: def("delivery", "cancelled", "danger", XCircle, [], { terminal: true, requiresConfirm: true }),
  returning: def("delivery", "returning", "orange", CornerUpLeft, ["returned"]),
  returned: def("delivery", "returned", "rose", Undo2, [], { terminal: true, requiresConfirm: true }),
  exchange: def("delivery", "exchange", "info", Repeat, []),
  swap: def("delivery", "swap", "indigo", ArrowLeftRight, []),
};

export const PRODUCT_STATUS: Record<string, StatusDef> = {
  to_be_tested: def("product", "to_be_tested", "neutral", FlaskConical, ["tested", "cancelled"]),
  tested: def("product", "tested", "info", Beaker, ["confirmed", "cancelled"]),
  confirmed: def("product", "confirmed", "success", BadgeCheck, [], { terminal: true }),
  cancelled: def("product", "cancelled", "danger", Ban, [], { terminal: true, requiresConfirm: true }),
};

export const TASK_STATUS: Record<string, StatusDef> = {
  todo: def("task", "todo", "neutral", Circle, ["doing", "blocked", "done"]),
  doing: def("task", "doing", "info", CircleDot, ["blocked", "done", "todo"]),
  blocked: def("task", "blocked", "danger", OctagonAlert, ["doing", "todo"]),
  done: def("task", "done", "success", CircleCheck, [], { terminal: true }),
};

export const STATUS_KINDS: Record<StatusKind, Record<string, StatusDef>> = {
  confirmation: CONFIRMATION_STATUS,
  delivery: DELIVERY_STATUS,
  product: PRODUCT_STATUS,
  task: TASK_STATUS,
};

export function getStatus(kind: StatusKind, key: string): StatusDef | undefined {
  return STATUS_KINDS[kind]?.[key];
}

/**
 * Colors for fixed (non-transitional) enum fields — same token palette as
 * statuses, so a source or category swatch reads as the same visual language
 * as a status pill. Not `option_sets` (Phase 12 §9): those are user-editable
 * taxonomies with their own color picker; these are Postgres enum values
 * (`src/lib/enums.ts`), fixed like statuses, just without transitions.
 */
export const ORDER_SOURCE_TOKEN: Record<string, StatusToken> = {
  shopify: "success",
  lightfunnels: "cyan",
  manual: "violet",
};

export const EXPENSE_CATEGORY_TOKEN: Record<string, StatusToken> = {
  shooting: "violet",
  packaging: "cyan",
  sampling: "warning",
  confirmation: "info",
  delivery: "indigo",
  test_ads: "orange",
  scaling_ads: "danger",
  other: "neutral",
};

export const SUPPLIER_TYPE_TOKEN: Record<string, StatusToken> = {
  shooting_studio: "violet",
  atelier_couture: "cyan",
  emballage: "orange",
  other: "neutral",
};

export const TASK_PRIORITY_TOKEN: Record<string, StatusToken> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
};

/** Meeting status isn't a StatusKind (no StatusSelect — meetings transition
 * via dedicated actions, not a generic dropdown). "ready" is a UI-computed
 * pseudo-state (every objective checked/deferred, not yet marked held), not
 * a DB value. */
export const MEETING_STATUS_TOKEN: Record<string, StatusToken> = {
  planned: "neutral",
  ready: "info",
  held: "success",
  cancelled: "danger",
};

/** Current status + its legal next states (both as full defs), for a status select. */
export function transitionsFor(kind: StatusKind, current: string): StatusDef[] {
  const def = getStatus(kind, current);
  if (!def) return [];
  const keys = [current, ...def.next];
  return keys.map((k) => getStatus(kind, k)).filter((d): d is StatusDef => Boolean(d));
}

/** Every status of a kind, in definition order — orders (confirmation/delivery)
 * dropped the rigid transition graph (Phase 14a): within their role, users may
 * set any status in their domain, not just a `next[]` neighbor. */
export function allStatuses(kind: StatusKind): StatusDef[] {
  return Object.values(STATUS_KINDS[kind]);
}

/** Kinds where every status is freely reachable (Phase 14a decision). */
const FREE_TRANSITION_KINDS: StatusKind[] = ["confirmation", "delivery"];

export function statusOptionsFor(kind: StatusKind, current: string): StatusDef[] {
  return FREE_TRANSITION_KINDS.includes(kind) ? allStatuses(kind) : transitionsFor(kind, current);
}

/** Single merged status for the one-column Orders UI: delivery once confirmed,
 * else confirmation. */
export function currentStatus(order: { confirmation_status: string; delivery_status: string }): {
  kind: "confirmation" | "delivery";
  key: string;
} {
  return order.confirmation_status === "confirmed"
    ? { kind: "delivery", key: order.delivery_status }
    : { kind: "confirmation", key: order.confirmation_status };
}
