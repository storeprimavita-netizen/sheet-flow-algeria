import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserRole, ROLE_LABEL } from "@/lib/rbac";

import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const role = await getCurrentUserRole();

  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">MNW ERP</h1>
      <p className="mt-1 text-sm text-neutral-600">
        Signed in as {user.email}
      </p>

      <div className="mt-6 rounded border border-neutral-200 p-4">
        <p className="text-sm text-neutral-600">Your role</p>
        <p className="text-lg font-medium">
          {role ? ROLE_LABEL[role] : "no role assigned"}
        </p>
        {!role && (
          <p className="mt-1 text-xs text-amber-600">
            Sign in once so the auth trigger creates your role row, then an
            admin can promote you.
          </p>
        )}
      </div>

      <div className="mt-6">
        <SignOutButton />
      </div>
    </main>
  );
}
