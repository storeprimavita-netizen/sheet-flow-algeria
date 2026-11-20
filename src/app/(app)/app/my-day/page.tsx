import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";
import { getProfile, getUser } from "@/lib/rbac";
import { getMyDay } from "@/lib/my-day";
import { MyDayView } from "./my-day-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("myDay");
  return { title: t("title") };
}

/** Agent home (D86): read-only, own session, counts only. The layout already refuses admins. */
export default async function MyDayPage() {
  const [user, profile] = await Promise.all([getUser(), getProfile()]);
  if (!user || !profile || profile.role === "admin") return null;
  const supabase = await createClient();
  return <MyDayView data={await getMyDay(supabase, user.id, profile.role)} />;
}
