import "server-only";

import { createClient } from "@/lib/supabase/server";

/** The workspace's store (one per workspace in the UI for now). Session client: RLS decides. */
export async function getStore() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stores")
    .select("id, slug, name, status, settings")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data;
}

export type StoreRecord = NonNullable<Awaited<ReturnType<typeof getStore>>>;
