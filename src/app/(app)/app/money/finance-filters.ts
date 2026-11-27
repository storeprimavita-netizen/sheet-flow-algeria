import { z } from "zod";

import { AD_KINDS, EXPENSE_CATEGORIES } from "@/lib/enums";
import { isRealIsoDate } from "@/lib/query-string";

const date = z.string().refine(isRealIsoDate).optional().catch(undefined);

/** URL filters of the Finance lists. A malformed value is ignored, never sent to the database. */
const schema = z.object({
  from: date,
  to: date,
  product: z.guid().optional().catch(undefined),
  category: z.enum(EXPENSE_CATEGORIES).optional().catch(undefined),
  kind: z.enum(AD_KINDS).optional().catch(undefined),
});

export function parseFinanceFilters(searchParams: Record<string, string | string[] | undefined>) {
  return schema.parse(searchParams);
}
