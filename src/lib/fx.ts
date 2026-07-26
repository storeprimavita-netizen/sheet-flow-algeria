import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";
import { CURRENCY_CODES } from "@/lib/enums";

/** Current rate for a currency, or 1 for DZD / when none is set yet. */
export async function fxRateFor(
  supabase: SupabaseClient<Database>,
  workspaceId: string,
  currency: (typeof CURRENCY_CODES)[number],
): Promise<number> {
  if (currency === "DZD") return 1;
  const { data } = await supabase.rpc("current_fx_rate", { p_ws: workspaceId, p_currency: currency });
  return typeof data === "number" && data > 0 ? data : 1;
}
