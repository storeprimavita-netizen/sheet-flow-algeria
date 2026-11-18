import "server-only";

import { notFound } from "next/navigation";

import { getProfile } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";

/** Pages stream in parallel with the layout, so every Store page and data helper re-checks the role itself. */
export async function requireStoreAdmin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") notFound();
  return profile;
}

/** The workspace's store (one per workspace in the UI for now). Session client: RLS decides. */
export async function getStore() {
  await requireStoreAdmin();
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
