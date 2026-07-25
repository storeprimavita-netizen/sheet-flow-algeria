import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

export const SETTING_KEYS = {
  lightfunnelSecret: "lightfunnel_secret",
  shopifySecret: "shopify_secret",
  slackBotToken: "slack_bot_token",
  slackChannelId: "slack_channel_id",
} as const;

/** Read a single secret. Uses the service-role client (webhook context). */
export async function getSetting(key: string): Promise<string | null> {
  const supabase = await createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? null;
}

/** Read several settings with a caller-supplied client (RLS enforces admin). */
export async function readSettings(
  supabase: SupabaseClient<Database>,
  keys: string[],
): Promise<Record<string, string>> {
  const { data } = await supabase.from("app_settings").select("key, value").in("key", keys);
  const out: Record<string, string> = {};
  for (const row of data ?? []) out[row.key] = row.value;
  return out;
}
