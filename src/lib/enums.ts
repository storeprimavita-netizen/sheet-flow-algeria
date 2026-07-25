/**
 * Source-of-truth enum value lists. Mirror the Postgres enums in
 * `supabase/migrations/00001_init.sql` and drive every <select> + status badge.
 */

export const PRODUCT_STATUSES = [
  "to_be_tested",
  "tested",
  "confirmed",
  "cancelled",
] as const;

export const CONFIRMATION_STATUSES = [
  "wait_for_confirmation",
  "not_answer",
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
] as const;

export const CONTACT_TYPES = [
  "shooting_studio",
  "atelier_couture",
  "emballage",
  "customer",
  "supplier",
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
