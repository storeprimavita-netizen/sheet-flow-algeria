import { z } from "zod";

const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  });

/** Every table with an `audit_row()` trigger (checked against the local DB in params.rls.test.ts). */
export const AUDITED_TABLES = [
  "account_topups",
  "accounts",
  "cash_collections",
  "exchange_rates",
  "expenses",
  "fixed_fees",
  "integration_configs",
  "option_sets",
  "options",
  "product_costs",
  "product_option_values",
  "product_options",
  "product_pricing",
  "reviews",
  "season_periods",
  "seasons",
  "settings",
  "store_pages",
  "status_label_overrides",
  "stores",
  "wilaya_fees",
  "zr_shipments",
] as const;

export type AuditParams = { table: string; actor: string; from: string; to: string };

/** Invalid URL values are dropped instead of reaching Postgres (22007 / 22P02). */
export function parseAuditParams(sp: Record<string, string | string[] | undefined>): AuditParams {
  const pick = (v: unknown, schema: z.ZodType<string>) => {
    const r = schema.safeParse(v);
    return r.success ? r.data : "";
  };
  return {
    table: pick(sp.table, z.enum(AUDITED_TABLES)),
    actor: pick(sp.actor, z.string().uuid()),
    from: pick(sp.from, DATE),
    to: pick(sp.to, DATE),
  };
}

/** Algeria is UTC+1 all year (no DST): day boundaries in that fixed zone. */
export const AUDIT_TZ = "+01:00";
export const dayStart = (d: string) => `${d}T00:00:00${AUDIT_TZ}`;
export const nextDayStart = (d: string) => {
  const n = new Date(`${d}T00:00:00Z`);
  n.setUTCDate(n.getUTCDate() + 1);
  return dayStart(n.toISOString().slice(0, 10));
};
