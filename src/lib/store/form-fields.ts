import { z } from "zod";

import { stripEmoji } from "./url";

/**
 * Order-form fields of one product (table product_forms). The database only checks size and shape;
 * this is the real contract. Labels are stored in the store's language, so a core field without a
 * label shows the translated default string supplied by the page.
 */
export const CORE_KEYS = ["name", "phone", "wilaya", "commune", "delivery"] as const;
export const OPTIONAL_KEYS = ["note", "email"] as const;
export const MAX_CUSTOM_FIELDS = 5;
export const MAX_SELECT_OPTIONS = 10;

export type BuiltinKey = (typeof CORE_KEYS)[number] | (typeof OPTIONAL_KEYS)[number];
export type CoreField = { type: "core"; key: BuiltinKey; label?: string; required: boolean; enabled: boolean };
export type FormField =
  | CoreField
  | { type: "text"; key: string; label: string; required: boolean; enabled: boolean }
  | { type: "select"; key: string; label: string; required: boolean; enabled: boolean; options: string[] };

/** Plain text only: no HTML, no emoji (the store never shows emoji). */
const plain = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !/[<>]/.test(v), "no HTML")
    .refine((v) => stripEmoji(v) === v, "no emoji");

const customKey = z.string().regex(/^c[1-5]$/);

const coreSchema = z
  .object({
    type: z.literal("core"),
    key: z.enum([...CORE_KEYS, ...OPTIONAL_KEYS]),
    label: plain(60).optional(),
    required: z.boolean(),
    enabled: z.boolean(),
  })
  .strict();
const textSchema = z
  .object({ type: z.literal("text"), key: customKey, label: plain(60), required: z.boolean(), enabled: z.boolean() })
  .strict();
const selectSchema = z
  .object({
    type: z.literal("select"),
    key: customKey,
    label: plain(60),
    required: z.boolean(),
    enabled: z.boolean(),
    options: z.array(plain(40)).min(2).max(MAX_SELECT_OPTIONS),
  })
  .strict();

export const formFieldSchema = z.discriminatedUnion("type", [coreSchema, textSchema, selectSchema]);
export const formFieldsSchema = z.array(formFieldSchema).max(CORE_KEYS.length + OPTIONAL_KEYS.length + MAX_CUSTOM_FIELDS);

export const DELIVERY_METHODS = ["home", "stopdesk"] as const;
export const deliveryMethodsSchema = z.array(z.enum(DELIVERY_METHODS)).min(1).max(2);

function defaultCoreFields(): CoreField[] {
  return [
    ...CORE_KEYS.map((key): CoreField => ({ type: "core", key, required: true, enabled: true })),
    { type: "core", key: "note", required: false, enabled: true },
    { type: "core", key: "email", required: false, enabled: false },
  ];
}

export const defaultFormFields = (): FormField[] => defaultCoreFields();

/**
 * Canonical list: the five core fields always present, enabled and required (the order cannot be
 * submitted without them); note/email optional; at most five custom fields with unique keys.
 */
export function normalizeFormFields(input: FormField[]): FormField[] {
  const out: FormField[] = defaultCoreFields().map((def): CoreField => {
    const found = input.find((f) => f.type === "core" && f.key === def.key);
    if (!found || found.type !== "core") return def;
    const forced = (CORE_KEYS as readonly string[]).includes(def.key);
    return { ...def, label: found.label, required: forced ? true : found.required, enabled: forced ? true : found.enabled };
  });
  const seen = new Set<string>();
  for (const f of input) {
    if (f.type === "core" || seen.has(f.key) || seen.size >= MAX_CUSTOM_FIELDS) continue;
    seen.add(f.key);
    out.push(f);
  }
  return out;
}

/** Read path: anything invalid in the database renders the defaults, never a broken form. */
export function parseFormFields(raw: unknown): FormField[] {
  const r = formFieldsSchema.safeParse(raw);
  return r.success ? normalizeFormFields(r.data) : defaultFormFields();
}

export function parseDeliveryMethods(raw: unknown): (typeof DELIVERY_METHODS)[number][] {
  const r = deliveryMethodsSchema.safeParse(raw);
  return r.success ? [...new Set(r.data)] : [...DELIVERY_METHODS];
}
