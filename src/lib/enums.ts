/**
 * Source-of-truth enum value lists. Mirror the Postgres enums in
 * `supabase/migrations/00001_core.sql` and drive every <select> + status badge.
 */

export const PRODUCT_STATUSES = [
  "to_be_tested",
  "tested",
  "confirmed",
  "cancelled",
] as const;

export const CONFIRMATION_STATUSES = [
  "wait_for_confirmation",
  "no_answer",
  "closed_phone",
  "cancelled",
  "confirmed",
] as const;

export const DELIVERY_STATUSES = [
  "wait_for_deposit",
  "bureau_deposited",
  "in_transit",
  "out_for_delivery",
  "stop_desk_waiting",
  "delivered",
  "cancelled",
  "delayed",
  "returning",
  "returned",
  "exchange",
  "swap",
] as const;

export const SUPPLIER_TYPES = [
  "shooting_studio",
  "atelier_couture",
  "emballage",
  "other",
] as const;

export const EXPENSE_CATEGORIES = [
  "shooting",
  "packaging",
  "sampling",
  "confirmation",
  "delivery",
  "test_ads",
  "scaling_ads",
  "other",
] as const;

export const ORDER_SOURCES = ["shopify", "lightfunnels", "manual"] as const;

export const DELIVERY_TYPES = ["home", "stopdesk"] as const;

export const DELIVERY_FEE_SOURCES = ["payload", "wilaya_table", "manual"] as const;

export const CURRENCY_CODES = ["DZD", "USD", "EUR"] as const;

export const AD_KINDS = ["test", "scaling"] as const;

export const TASK_STATUSES = ["todo", "doing", "blocked", "done"] as const;

export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

// Manual stock-movement entry only allows these two — delivered/returned are
// written by the order-status trigger, never by hand (Phase 5).
export const MANUAL_STOCK_REASONS = ["purchase", "correction"] as const;

// ponytail: fixed low-stock threshold; becomes a settings key when a phase needs it tunable
export const LOW_STOCK_THRESHOLD = 5;

// Rule categories — 4 fixed buckets, not user-extensible (no option_set).
// Upgrade to option_sets if user asks for custom categories.
export const RULE_CATEGORIES = [
  { value: "must",             label: "Must",             token: "danger"  },
  { value: "product_choice",   label: "Product choice",   token: "info"    },
  { value: "new_product_task", label: "New product task",  token: "violet"  },
  { value: "delivery",         label: "Delivery",         token: "success" },
] as const;
