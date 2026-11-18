import { notFound } from "next/navigation";

import { getProfile } from "@/lib/rbac";

/** Admin only. Agents get a plain 404 (the Store group is also hidden from their sidebar). RLS is the real wall. */
export default async function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();
  if (profile?.role !== "admin") notFound();
  return children;
}
